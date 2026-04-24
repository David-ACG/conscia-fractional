# Plan: Daily Automated Backup + Daily Draft Invoice Email

**Date:** 2026-04-24
**Status:** Awaiting Review
**Source Idea:** IDEA_2026-04-24_daily-backup-and-invoice.md

## Overview

Two independent scheduled jobs that protect FractionalBuddy's operational data and give David daily billing visibility.

1. **Daily backup** — runs at 02:00 UTC, dumps every operational table (time entries, meetings, clients, engagements, invoices, tasks, contacts, CRM customers, notes, assets, user roles) as JSON, zips them, and emails the archive to `david@agilecommercegroup.com`.
2. **Daily draft invoice** — runs at 07:00 UTC, computes current-month-to-date hours/days/amount per active engagement using the existing `calculateMonthBreakdown` / `buildInvoiceText` helpers, and emails an HTML summary to `david@agilecommercegroup.com`.

Both share a new Resend-based email service and a new `cron_runs` table for observability.

## Goals

- No manual backup process — data loss risk from Supabase outage or accidental deletion is covered.
- David receives a daily email showing current month-to-date billable hours and amount per client.
- Every cron run is logged with success/failure + error message for later forensics.
- Backup file is attached to the email (not stored in a third-party bucket) so recovery requires only Gmail.
- Two new settings pages (`/settings/backups`, `/settings/invoice-preview`) let David inspect run history and preview tomorrow's email.
- Full Vitest + Playwright coverage.

## Scope

### In Scope

- New email service wrapping Resend (with attachment support).
- New `cron_runs` table (unified log for both jobs via `job_type` enum).
- New `/api/cron/daily-backup` route — queries tables via service-role admin client, zips JSON dumps in-memory, emails attachment.
- New `/api/cron/daily-invoice` route — iterates active engagements, reuses existing invoice-text helpers, emails HTML summary.
- Two Vercel cron entries in `vercel.json`.
- New `/settings/backups` page — last 30 backup runs (status, size, timestamp, error) with "Run now" button.
- New `/settings/invoice-preview` page — live preview of today's draft-invoice email + "Send test now" button.
- Unit tests (Vitest) for backup, invoice, and email services.
- Playwright browser tests for both new UI pages.
- Manifest file inside each backup zip listing table names + row counts + dump timestamp.

### Out of Scope

- Writing backups to Google Drive / S3 / R2 (attachment path is sufficient for current data size; revisit if zip ever exceeds ~15 MB).
- Point-in-time restore UI (restoration is manual: download attachment, paste SQL into Supabase SQL Editor — documented separately).
- Encrypting the backup archive (email-at-rest in Gmail is considered acceptable; revisit if dataset grows).
- Multi-tenant user iteration (app is currently single-user; recipient is hardcoded to `ALERT_EMAIL` env var).
- Domain verification for Resend (use Resend's shared `onboarding@resend.dev` sender for v1, `reply-to: david@agilecommercegroup.com`).
- Committing new invoice rows to the `invoices` table (draft = email-only snapshot, not a DB record).
- Backing up Supabase `auth.*` tables, integration tokens, or embedding vectors (re-creatable).
- Retention policy / automatic deletion of old backups (Gmail handles storage).

## Technical Approach

### Email infrastructure (Resend)

- Install `resend` package.
- Add env vars: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`), `ALERT_EMAIL` (= `david@agilecommercegroup.com`).
- New service `src/lib/services/email-service.ts` exporting `sendEmail({to, subject, html, text?, attachments?})`. Returns `{ id }` on success, throws on failure.
- Helper `buildFailureEmail(jobName, error)` for error alerts.

### Backup service

- New service `src/lib/services/backup-service.ts`.
- `BACKUP_TABLES` constant lists the 11 tables (time_entries, meetings, clients, crm_customers, contacts, engagements, invoices, tasks, notes, assets, user_roles).
- `createBackup()` — iterates tables, uses service-role admin client to `SELECT *` from each, builds `{tableName}.json` buffers, adds `manifest.json` with `{generatedAt, rowCounts, tablesSucceeded, tablesFailed}`, zips everything with `jszip`. Returns `{ zipBuffer, manifest }`.
- Truncate `meetings.transcript` field? **No** — transcripts are the most valuable thing to protect, and the dataset is small enough.

### Daily backup cron route

- `src/app/api/cron/daily-backup/route.ts` — GET handler, Bearer `CRON_SECRET` auth (same pattern as `drive-sync`).
- Flow: call `createBackup()` → attach zip to email via `email-service` → insert row in `cron_runs` with `job_type='backup'`, status, row-count JSON, error message if any. On email failure, still record the DB row.
- Filename format: `fractionalbuddy-backup-YYYY-MM-DD.zip`.
- Email subject: `[FractionalBuddy Backup] YYYY-MM-DD — N tables, M rows`.
- `export const maxDuration = 300;` (Vercel serverless limit) to accommodate large zips.

### Daily invoice service + route

- New service `src/lib/services/daily-invoice-service.ts`.
- `computeDailySnapshot()` — fetches active engagements (defined as: engagement with `ended_at IS NULL` or `ended_at >= today`), for each computes current-month-to-date time entries → reuses `calculateMonthBreakdown` and a trimmed `buildInvoiceText`-style formatter → returns `DailySnapshot[]` with per-client rows + grand total.
- `renderSnapshotHtml(snapshots)` — HTML table with Client / Hours / Days / Rate / Amount columns + grand total footer + link to `/invoices` page.
- `src/app/api/cron/daily-invoice/route.ts` — GET handler, same Bearer auth.
- On success: email HTML to `ALERT_EMAIL`, insert `cron_runs` row (`job_type='daily_invoice'`, row_count = number of engagements summarised, payload = grand total).
- Email subject: `[FractionalBuddy Draft Invoice] MMM YYYY — £X,XXX.XX to date`.

### `cron_runs` table (migration 020)

```sql
CREATE TABLE cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL CHECK (job_type IN ('backup','daily_invoice')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('success','failure','running')),
  payload JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cron_runs_job_type_started ON cron_runs(job_type, started_at DESC);
```

- RLS: allow SELECT for authenticated users only (admin features live under `/settings/*` gated by app-layer auth already). No INSERT/UPDATE/DELETE for anon — only service role from cron routes.

### Vercel cron configuration

Append to `vercel.json`:

```json
{ "path": "/api/cron/daily-backup",  "schedule": "0 2 * * *" },
{ "path": "/api/cron/daily-invoice", "schedule": "0 7 * * *" }
```

### Settings UI

- **`/settings/backups`** — server component rendering a `<Table>` of last 30 `cron_runs` where `job_type='backup'`. Columns: Started, Duration, Status, Rows, Size, Error. "Run backup now" button triggers server action that fetches the cron route with `CRON_SECRET` header.
- **`/settings/invoice-preview`** — server component renders the snapshot HTML (same one the cron sends) for TODAY. "Send test email now" button calls the daily-invoice cron route.

### Testing Plan

- **Vitest unit tests:**
  - `email-service.test.ts` — mocks Resend, asserts correct payload shape, attachment encoding, throws on API error.
  - `backup-service.test.ts` — mocks admin client, asserts zip contains every BACKUP_TABLES entry + manifest, row counts correct, empty-table graceful.
  - `daily-invoice-service.test.ts` — stub engagements + time entries, assert `DailySnapshot[]` totals, `renderSnapshotHtml` contains expected £ figures.
  - `cron/daily-backup/route.test.ts` — asserts 401 without Bearer, success path calls backup+email+insert, failure path still inserts `cron_runs` row.
  - `cron/daily-invoice/route.test.ts` — same structure.
- **Playwright browser tests** (under `tests/` using existing `pytest-playwright` pattern, headless chromium):
  - `test_backups_page.py` — login as David, navigate to `/settings/backups`, assert page renders the table, click "Run backup now", wait for toast, assert new row appears at top within 10 s.
  - `test_invoice_preview_page.py` — login, navigate to `/settings/invoice-preview`, assert "Current Month" heading, assert grand-total line contains `£`, click "Send test email now", assert success toast.

## Files Affected / Created

| File                                                               | Action | Notes                                               |
| ------------------------------------------------------------------ | ------ | --------------------------------------------------- |
| `package.json`                                                     | Modify | Add `resend`, `jszip`                               |
| `supabase/migrations/020_cron-runs.sql`                            | Create | `cron_runs` table + RLS                             |
| `src/lib/services/email-service.ts`                                | Create | Resend wrapper w/ attachment support                |
| `src/lib/services/backup-service.ts`                               | Create | JSON-per-table → zip                                |
| `src/lib/services/daily-invoice-service.ts`                        | Create | Month-to-date snapshot + HTML render                |
| `src/app/api/cron/daily-backup/route.ts`                           | Create | Bearer auth, runs backup, emails zip, logs run      |
| `src/app/api/cron/daily-invoice/route.ts`                          | Create | Bearer auth, sends draft-invoice email, logs run    |
| `src/app/(dashboard)/settings/backups/page.tsx`                    | Create | History table + run-now button                      |
| `src/app/(dashboard)/settings/invoice-preview/page.tsx`            | Create | Live preview + send-test button                     |
| `src/lib/actions/cron-runs.ts`                                     | Create | Server action `triggerBackupNow`, `triggerInvoiceNow` |
| `vercel.json`                                                      | Modify | Add two cron entries                                |
| `src/lib/services/__tests__/email-service.test.ts`                 | Create | Vitest                                              |
| `src/lib/services/__tests__/backup-service.test.ts`                | Create | Vitest                                              |
| `src/lib/services/__tests__/daily-invoice-service.test.ts`         | Create | Vitest                                              |
| `src/app/api/cron/daily-backup/__tests__/route.test.ts`            | Create | Vitest                                              |
| `src/app/api/cron/daily-invoice/__tests__/route.test.ts`           | Create | Vitest                                              |
| `tests/test_backups_page.py`                                       | Create | Playwright                                          |
| `tests/test_invoice_preview_page.py`                               | Create | Playwright                                          |
| `.env.example` (and README/env docs if present)                    | Modify | Document `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `ALERT_EMAIL` |

## Acceptance Criteria

- [ ] `supabase/migrations/020_cron-runs.sql` applied cleanly to production.
- [ ] `npm test` passes all new Vitest files.
- [ ] `python -m pytest tests/test_backups_page.py tests/test_invoice_preview_page.py --browser chromium` passes headless.
- [ ] Manual invocation `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/daily-backup` yields (a) zip email in David's inbox with `fractionalbuddy-backup-YYYY-MM-DD.zip` attached, (b) new `cron_runs` row with `status='success'`.
- [ ] Manual invocation of `/api/cron/daily-invoice` yields (a) HTML email showing per-engagement month-to-date figures and grand total, (b) new `cron_runs` row.
- [ ] `/settings/backups` renders without console errors and shows the runs from above.
- [ ] `/settings/invoice-preview` renders without console errors and shows the same figures as the email would.
- [ ] `vercel.json` contains both cron entries with `0 2 * * *` and `0 7 * * *` schedules.
- [ ] Unzipping a produced backup yields one `.json` per table in `BACKUP_TABLES` plus a `manifest.json`.
- [ ] A deliberately-failed backup (e.g. bad table name in `BACKUP_TABLES`) still produces a `cron_runs` row with `status='failure'` and sends a failure alert email.

## Dependencies

- `RESEND_API_KEY` set in env (David creates a free account at resend.com, obtains an API key, adds to `.env.local` and Vercel env vars). **This is a David-action dependency**, not a code blocker — prompts 01–05 can be built and tested with a stub Resend API key; actual email delivery verification happens after David provisions the key.
- Vercel cron runs only on deployed environments — local verification uses `curl` with the Bearer secret.

## Testing Plan

- Unit tests: `npm test` (Vitest)
- Browser tests: Playwright CLI (`python -m pytest tests/test_backups_page.py tests/test_invoice_preview_page.py -v --browser chromium`)
- Manual smoke: `curl` each cron route locally, check inbox + DB, check `/settings/*` pages.

## Estimated Complexity

**Medium** — 5 prompts, each self-contained. No novel tech (Resend, jszip, Next.js cron pattern all well-documented). Main risk is email delivery edge cases (attachment size, Resend rate limits) which only surface in production; local tests stub the provider.

---

<!-- GATE BELOW — Filled in by Claude after plan writing. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Scope is correctly bounded — backup AND draft invoice delivered, but nothing else (no restore UI, no Drive upload, no domain verification)
- [ ] Technical approach matches the stack — Next.js 16 API routes, Supabase admin client, Vercel Cron, Resend
- [ ] Files affected list is complete and accurate — 19 files listed, 5 prompts
- [ ] Acceptance criteria are specific and testable — each cron verified locally via curl + email check + `cron_runs` row
- [ ] No unexpected dependencies introduced — only `resend` and `jszip` (both mainstream, MIT)
- [ ] Estimated complexity feels right — Medium, 5 prompts of self-contained work
- [ ] Decisions documented: Resend (not Gmail OAuth), email attachment (not Drive), email-only snapshot (not DB row), 02/07 UTC schedule
- [ ] 15-min ceiling rounding rule honoured in the invoice service (memory `feedback_time_rounding.md`)
- [ ] Single-tenant recipient assumption noted explicitly (out of scope: multi-tenant iteration)
- [ ] Playwright tests included for both new UI pages

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-04-24_daily-backup-and-invoice.md`

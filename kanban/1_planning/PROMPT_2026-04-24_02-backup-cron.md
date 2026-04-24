# Task: Daily backup cron — zip all operational tables, email attachment, log run

**Date:** 2026-04-24
**Plan Reference:** PLAN_2026-04-24_daily-backup-and-invoice.md
**Depends on:** PROMPT_2026-04-24_01-email-service-resend.md (email-service must exist)

## What to change

Add a daily cron that exports every operational Supabase table to JSON, zips them into a single archive, emails the archive to `ALERT_EMAIL`, and records the run in a new `cron_runs` table. Schedule it at 02:00 UTC via Vercel Cron.

## Specific Instructions

1. **Create migration** `supabase/migrations/020_cron-runs.sql`:

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

   ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "authenticated can read cron_runs"
     ON cron_runs FOR SELECT
     TO authenticated
     USING (true);
   ```

   Apply the migration in Supabase SQL Editor manually (see memory `reference_migrations.md`). Document this as an action for David in the final handoff.

2. **Install `jszip`**: `npm install jszip`.

3. **Create `src/lib/services/backup-service.ts`**:

   ```ts
   export const BACKUP_TABLES = [
     "time_entries",
     "meetings",
     "clients",
     "crm_customers",
     "contacts",
     "engagements",
     "invoices",
     "tasks",
     "notes",
     "assets",
     "user_roles",
   ] as const;

   export type BackupManifest = {
     generatedAt: string;       // ISO-8601
     rowCounts: Record<string, number>;
     tablesSucceeded: string[];
     tablesFailed: { table: string; error: string }[];
   };

   export async function createBackup(): Promise<{
     zipBuffer: Buffer;
     manifest: BackupManifest;
   }>;
   ```

   - Use `createAdminClient()` from `@/lib/supabase/admin` to bypass RLS.
   - For each table in `BACKUP_TABLES`, `SELECT *` with no limit; if the query errors, record the table in `tablesFailed` and continue (partial backup is better than no backup).
   - Serialize each table's rows to pretty-printed JSON (`JSON.stringify(rows, null, 2)`) and add to the zip as `{tableName}.json`.
   - Add `manifest.json` to the zip last.
   - Return the zip as a Buffer (use `zip.generateAsync({ type: "nodebuffer" })`).

4. **Create `src/app/api/cron/daily-backup/route.ts`**:

   ```ts
   // Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/daily-backup
   export const maxDuration = 300;
   ```

   Flow:

   - GET handler. Bearer auth against `CRON_SECRET` (exactly matching the pattern in `src/app/api/cron/drive-sync/route.ts`).
   - Insert a `cron_runs` row with `job_type='backup'`, `status='running'` at the start — capture its `id`.
   - Call `createBackup()`.
   - Build filename `fractionalbuddy-backup-YYYY-MM-DD.zip` (UTC date).
   - Build email subject `[FractionalBuddy Backup] YYYY-MM-DD — ${tablesSucceeded.length} tables, ${totalRows} rows`. If `tablesFailed.length > 0`, prepend `[PARTIAL]` to the subject.
   - Body HTML: a small summary table listing each table + row count + success/error, plus the total duration.
   - Call `sendEmail()` with `to: ALERT_EMAIL`, the HTML, and the attachment `{ filename, content: zipBuffer, contentType: "application/zip" }`.
   - On success: UPDATE the `cron_runs` row to `status='success'`, `completed_at=NOW()`, `payload={rowCounts, tablesFailed, totalBytes, emailId}`.
   - On any thrown error (backup OR email): UPDATE the `cron_runs` row to `status='failure'`, `error_message=err.message`. Attempt a separate failure email via `sendEmail({subject: "[FractionalBuddy Backup FAILED]", ...})`, but swallow errors from that call (don't mask the original).
   - Return `NextResponse.json({ success, cronRunId, tablesSucceeded, tablesFailed, totalRows, durationMs })`.

5. **Update `vercel.json`** — append to the `crons` array:

   ```json
   { "path": "/api/cron/daily-backup", "schedule": "0 2 * * *" }
   ```

6. **Unit tests:**

   - `src/lib/services/__tests__/backup-service.test.ts`:
     - Mock `createAdminClient` to return predefined rows for two tables and an error for a third.
     - Assert zip contains a JSON file per table plus `manifest.json`.
     - Assert manifest has `rowCounts`, `tablesSucceeded: ["table1","table2"]`, `tablesFailed: [{table: "table3", error: ...}]`.
     - Assert row counts match the mock data.
   - `src/app/api/cron/daily-backup/__tests__/route.test.ts`:
     - 401 without Bearer, 401 with wrong Bearer.
     - Happy path: mock `backup-service` + `email-service`, call route, assert (a) `cron_runs` insert with status=running, (b) update with status=success + payload, (c) email sent with attachment.
     - Failure path: stub `createBackup` to throw; assert (a) `cron_runs` updated to status=failure with error_message, (b) response 500 with error body, (c) a failure email was attempted.

7. Do NOT add any UI in this prompt — the `/settings/backups` page comes in Prompt 03.

## Files likely affected

- `package.json` (jszip)
- `supabase/migrations/020_cron-runs.sql` (new)
- `src/lib/services/backup-service.ts` (new)
- `src/lib/services/__tests__/backup-service.test.ts` (new)
- `src/app/api/cron/daily-backup/route.ts` (new)
- `src/app/api/cron/daily-backup/__tests__/route.test.ts` (new)
- `vercel.json` (modify)

## Acceptance criteria

- [ ] Migration file exists and is valid PostgreSQL; comment at the top tells David the exact URL to paste it at (`https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql/new`).
- [ ] `npm test -- backup-service` and `npm test -- daily-backup` both pass.
- [ ] Local `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/daily-backup` returns 200 with a JSON body containing `tablesSucceeded` and `totalRows` (smoke test in implementation notes).
- [ ] The local invocation produces a zip attachment in David's inbox containing one `.json` per table and `manifest.json`. (Depends on `RESEND_API_KEY` being set — if not set, skip this check and note it.)
- [ ] `cron_runs` row is created for every invocation (successful or failed).
- [ ] `vercel.json` contains the new cron entry with `0 2 * * *`.
- [ ] `npx tsc --noEmit` passes.

## Notes

- If the cron secret isn't set locally, the route returns 401 and that's fine — the tests bypass the route entirely by calling the handler function directly.
- Dataset is small — don't worry about streaming. In-memory zip is fine.
- Transcripts in `meetings` are preserved in full; losing them is the scenario we're protecting against.
- Schema is NOT backed up — it's in git migrations. The backup is data-only.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Instructions are clear and self-contained — migration, service, route, tests, vercel.json all specified
- [ ] File paths correct — matches existing `src/app/api/cron/drive-sync/` pattern exactly
- [ ] Acceptance criteria match the plan — email delivery verification noted as optional on RESEND_API_KEY presence
- [ ] No scope creep — does not build `/settings/backups` UI (that's Prompt 03)
- [ ] Migration application is called out as a David-action (Supabase SQL Editor — no programmatic DDL path per memory `reference_migrations.md`)
- [ ] Partial-backup behaviour specified (failed tables tracked in manifest, don't crash the whole run)
- [ ] Bearer auth pattern matches existing cron routes (`drive-sync` reference)
- [ ] `maxDuration = 300` set for Vercel serverless limit

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-24_02-backup-cron.md`

## Implementation Notes

## Testing Checklist

### Actions for David

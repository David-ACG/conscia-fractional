# Task: Daily draft invoice cron — email month-to-date summary per engagement

**Date:** 2026-04-24
**Plan Reference:** PLAN_2026-04-24_daily-backup-and-invoice.md
**Depends on:** PROMPT_2026-04-24_01-email-service-resend.md, PROMPT_2026-04-24_02-backup-cron.md (`cron_runs` table)

## What to change

Add a daily cron that computes current-month-to-date billable hours and amounts per active engagement, renders an HTML email summary, and emails it to `ALERT_EMAIL` at 07:00 UTC. Record the run in `cron_runs`.

## Specific Instructions

1. **Create `src/lib/services/daily-invoice-service.ts`** exporting:

   ```ts
   export type EngagementSnapshot = {
     engagementId: string;
     clientId: string;
     clientName: string;
     periodStart: string;   // ISO — first day of current month
     periodEnd: string;     // ISO — today (inclusive, UTC)
     totalHours: number;    // rounded per existing rule (15-min ceiling)
     totalDays: number;     // totalHours / hoursPerDay
     dayRateGbp: number;
     hourlyRateGbp: number;
     amountGbp: number;     // totalDays * dayRateGbp
     billingFrequency: string | null;
   };

   export type DailySnapshot = {
     generatedAt: string;
     periodLabel: string;   // e.g. "April 2026 to date (as of 24/04/2026)"
     engagements: EngagementSnapshot[];
     grandTotalHours: number;
     grandTotalDays: number;
     grandTotalGbp: number;
   };

   export async function computeDailySnapshot(today?: Date): Promise<DailySnapshot>;
   export function renderSnapshotHtml(snapshot: DailySnapshot): string;
   export function renderSnapshotText(snapshot: DailySnapshot): string;
   ```

   - Use `createAdminClient()`.
   - "Active engagement" = row in `engagements` where `ended_at IS NULL OR ended_at >= today`.
   - For each active engagement, fetch `time_entries` with `client_id = engagement.client_id` AND `is_billable = true` AND `started_at >= periodStart` AND `started_at < periodEnd + 1 day`.
   - `totalHours` uses `duration_minutes / 60`. **Apply the 15-minute-ceiling rounding rule** per memory `feedback_time_rounding.md`: round each time entry's minutes up to the nearest 15 before summing. Do this INSIDE the service — do not rely on stored values being pre-rounded.
   - `hoursPerDay` defaults to 8 (matches `buildInvoiceText` convention).
   - `dayRateGbp` from `engagement.day_rate_gbp`; if null, fall back to `engagement.hourly_rate_gbp * 8`; if still null, skip that engagement and record it in a `skipped` array on the snapshot (include in HTML as a warning row).
   - `amountGbp = totalDays * dayRateGbp`.

2. **`renderSnapshotHtml`**:

   - Inline styles only (email clients strip `<style>` tags).
   - Heading: `Draft invoice — {periodLabel}`.
   - One `<table>` with columns: Client, Hours, Days, Day Rate, Amount.
   - Footer row: "Grand total" spanning client+hours+days, plus the grand totals.
   - Below the table: a link `<a href="{APP_URL}/invoices">Open invoices in FractionalBuddy →</a>`.
   - Small-print line: "This is a draft snapshot — not a committed invoice. Billing cycle and rates from your active engagements.".
   - If `skipped.length > 0`, add a yellow warning div listing the client names and the reason ("missing day_rate_gbp").

3. **`renderSnapshotText`**: plain-text fallback for email clients that disable HTML. Simple Markdown-esque layout.

4. **Create `src/app/api/cron/daily-invoice/route.ts`**:

   - `export const maxDuration = 120;`
   - Bearer `CRON_SECRET` auth.
   - Insert `cron_runs` row (`job_type='daily_invoice'`, `status='running'`).
   - Call `computeDailySnapshot()`, render both HTML + text, send email:
     - Subject: `[FractionalBuddy Draft Invoice] {MMM YYYY} — £{grandTotalGbp.toLocaleString("en-GB", {minimumFractionDigits: 2, maximumFractionDigits: 2})} to date`
     - `to: ALERT_EMAIL`.
   - On success: UPDATE `cron_runs` with `status='success'`, `payload={engagementCount, grandTotalGbp, emailId}`.
   - On failure: UPDATE with `status='failure'`, `error_message`, send a failure alert email (swallow its errors).
   - Return JSON `{success, cronRunId, engagementCount, grandTotalGbp, durationMs}`.

5. **Update `vercel.json`**: append

   ```json
   { "path": "/api/cron/daily-invoice", "schedule": "0 7 * * *" }
   ```

6. **Unit tests:**

   - `src/lib/services/__tests__/daily-invoice-service.test.ts`:
     - Stub admin client with: 2 engagements, 5 time entries (mix of billable + non-billable, different dates).
     - Assert `computeDailySnapshot` returns 2 rows, correct `totalHours` after 15-min ceiling rounding.
     - Assert `grandTotalGbp === sum of per-row amounts`.
     - Assert `renderSnapshotHtml` output contains each client name, "Grand total", and `£`.
     - Assert an engagement with `day_rate_gbp=null` ends up in `skipped` and is excluded from the totals.
     - Assert `periodLabel` format matches regex `^[A-Z][a-z]+ \d{4} to date \(as of \d{2}\/\d{2}\/\d{4}\)$`.
   - `src/app/api/cron/daily-invoice/__tests__/route.test.ts`:
     - 401 without Bearer.
     - Happy path: cron_runs insert+update, email sent with HTML + text, response JSON shape.
     - Failure path: service throws → cron_runs updated to failure + alert email attempted.

7. Do NOT build the `/settings/invoice-preview` page in this prompt — that's Prompt 05.

## Files likely affected

- `src/lib/services/daily-invoice-service.ts` (new)
- `src/lib/services/__tests__/daily-invoice-service.test.ts` (new)
- `src/app/api/cron/daily-invoice/route.ts` (new)
- `src/app/api/cron/daily-invoice/__tests__/route.test.ts` (new)
- `vercel.json` (modify)

## Acceptance criteria

- [ ] `npm test -- daily-invoice` passes.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/daily-invoice` returns 200 with `engagementCount` and `grandTotalGbp` in the body.
- [ ] HTML email lands in David's inbox (when `RESEND_API_KEY` is set) with a readable table.
- [ ] `cron_runs` row inserted for each invocation.
- [ ] Engagements missing `day_rate_gbp` produce a visible warning in the email, don't crash the job, and don't inflate the grand total.
- [ ] 15-minute-ceiling rounding is applied per entry before summing (covered by tests).
- [ ] `vercel.json` cron array contains `{ "path": "/api/cron/daily-invoice", "schedule": "0 7 * * *" }`.
- [ ] `npx tsc --noEmit` passes.

## Notes

- Do NOT call `calculateMonthBreakdown` directly from `src/lib/actions/invoices.ts` if it's marked `"use server"` — import the computation logic into the service if needed, or duplicate the small amount of math. Server Actions cannot be called from cron routes (no user context).
- "Month-to-date" means from day 1 of the current calendar month to today inclusive, in UTC.
- Rate fallback ordering: `day_rate_gbp` → `hourly_rate_gbp * 8` → skip+warn. Do NOT invent a rate.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Instructions are clear and self-contained — service, route, tests, vercel.json all specified
- [ ] File paths correct — `daily-invoice-service.ts` alongside existing services, route under `src/app/api/cron/daily-invoice/`
- [ ] Acceptance criteria match the plan — 15-min ceiling rounding explicitly called out + test
- [ ] No scope creep — no UI in this prompt (preview page is Prompt 05)
- [ ] Rate fallback order is explicit (`day_rate_gbp` → `hourly_rate_gbp * 8` → skip+warn)
- [ ] Does NOT call `src/lib/actions/invoices.ts` (which is a server action) from cron context — logic duplicated where needed
- [ ] UTC-based month boundaries specified (avoids timezone ambiguity)
- [ ] Failure path sends alert email but swallows its own errors (defensive)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-24_04-daily-invoice-cron.md`

## Implementation Notes

## Testing Checklist

### Actions for David

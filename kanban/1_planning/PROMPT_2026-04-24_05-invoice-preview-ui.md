# Task: Invoice preview UI at /settings/invoice-preview with Playwright coverage

**Date:** 2026-04-24
**Plan Reference:** PLAN_2026-04-24_daily-backup-and-invoice.md
**Depends on:** PROMPT_2026-04-24_04-daily-invoice-cron.md (daily-invoice-service must exist)

## What to change

Add an admin page at `/settings/invoice-preview` that renders the exact HTML that today's draft-invoice email would contain, plus a "Send test now" button that invokes the daily-invoice cron route. Covers Playwright browser test.

## Specific Instructions

1. **Extend `src/lib/actions/cron-runs.ts`** (created in Prompt 03) with:

   ```ts
   export async function triggerDailyInvoiceNow(): Promise<{ ok: boolean; cronRunId?: string; error?: string }>;
   export async function listRecentDailyInvoiceRuns(limit: number = 10): Promise<CronRunRow[]>;
   ```

   Same pattern as the backup counterparts — server action, fetches the cron route with Bearer `CRON_SECRET`.

2. **Create `src/app/(dashboard)/settings/invoice-preview/page.tsx`**:

   - Server component.
   - Call `computeDailySnapshot()` and `renderSnapshotHtml()` at the top to get today's preview HTML.
   - Also call `listRecentDailyInvoiceRuns(10)`.
   - Render a shadcn `Card` with:
     - Header: "Draft invoice preview" + subtitle "Emailed daily at 07:00 UTC to david@agilecommercegroup.com.".
     - Action row: "Send test email now" button (client component) + last-run status summary ("Last sent: {started_at} — {status}").
     - Preview section: render the HTML returned by `renderSnapshotHtml` inside a bordered `<div>` with `dangerouslySetInnerHTML`. Wrap it in a `max-w-2xl` container mimicking email width.
     - Below: a small disclosure `<details>` with `<summary>Raw HTML</summary>` + `<pre>` showing the HTML source — useful for email template debugging.
     - At the bottom: a short `Table` of the last 10 invoice-cron runs (Started / Status / Grand total / Error).

3. **Create `src/app/(dashboard)/settings/invoice-preview/send-test-button.tsx`** (client component): button with loading state, calls `triggerDailyInvoiceNow()`, shows sonner toast, calls `router.refresh()` on success.

4. **Create `tests/test_invoice_preview_page.py`** (pytest-playwright):

   - Navigate to `/settings/invoice-preview` (authenticated — reuse `conftest.py` fixture from Prompt 03).
   - Assert heading `Draft invoice preview` appears.
   - Assert the preview region contains either:
     - A grand total row with `£` AND a number, OR
     - The empty-state "No active engagements" text (if the test env has no engagements).
   - Click "Send test email now".
   - Expect the button to show a loading spinner briefly.
   - Wait for a success toast or an updated "Last sent" timestamp.
   - Do NOT assert email delivery — Resend is mocked/stubbed at test time.

5. **Add nav link**: if `src/app/(dashboard)/settings/page.tsx` exists, add a link row "Invoice Preview → /settings/invoice-preview" (grep first; if none, skip).

## Files likely affected

- `src/lib/actions/cron-runs.ts` (modify — add two new functions)
- `src/app/(dashboard)/settings/invoice-preview/page.tsx` (new)
- `src/app/(dashboard)/settings/invoice-preview/send-test-button.tsx` (new)
- `src/app/(dashboard)/settings/page.tsx` (modify, only if exists)
- `tests/test_invoice_preview_page.py` (new)

## Acceptance criteria

- [ ] `/settings/invoice-preview` loads with 200 when authenticated, redirects to `/login` otherwise.
- [ ] Preview HTML renders without console errors — whatever `computeDailySnapshot` returns today is visible.
- [ ] "Send test email now" button triggers the cron and shows a success toast.
- [ ] Recent-runs table renders without errors.
- [ ] `python -m pytest tests/test_invoice_preview_page.py -v --browser chromium` passes headless.
- [ ] `npx tsc --noEmit` passes.

## Notes

- Rendering email HTML inside a page via `dangerouslySetInnerHTML` is fine here because the HTML is produced by our own renderer — no user input injected.
- The preview page exists so David can confirm formatting without waiting for 07:00 UTC.
- If there are zero active engagements, `computeDailySnapshot` should return an empty engagements array and `grandTotalGbp = 0`. The page should render an empty-state "No active engagements — nothing to invoice yet." in that case. Add a matching code path to `renderSnapshotHtml` if it doesn't already exist.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Instructions are clear and self-contained — extends existing cron-runs action, new page + button component, Playwright test
- [ ] File paths correct — `(dashboard)/settings/invoice-preview/` matches grouping
- [ ] Acceptance criteria match the plan — preview renders, test send works, recent-runs visible
- [ ] No scope creep — doesn't modify the cron route itself or the service (those were Prompt 04)
- [ ] Empty-state handling specified (zero active engagements = friendly empty state, not a crash)
- [ ] Playwright test deliberately avoids asserting email delivery (Resend mocked)
- [ ] `dangerouslySetInnerHTML` risk explicitly justified (HTML is from our own renderer, no user input)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-24_05-invoice-preview-ui.md`

## Implementation Notes

## Testing Checklist

### Actions for David

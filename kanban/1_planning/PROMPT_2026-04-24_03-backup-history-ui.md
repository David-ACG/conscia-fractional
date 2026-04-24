# Task: Backup history UI at /settings/backups with Playwright coverage

**Date:** 2026-04-24
**Plan Reference:** PLAN_2026-04-24_daily-backup-and-invoice.md
**Depends on:** PROMPT_2026-04-24_02-backup-cron.md (`cron_runs` table must exist + cron route must work)

## What to change

Add an admin page at `/settings/backups` that shows the last 30 backup runs with a "Run backup now" button. Covers Playwright browser test.

## Specific Instructions

1. **Create server action `src/lib/actions/cron-runs.ts`** exporting:

   ```ts
   export async function triggerBackupNow(): Promise<{ ok: boolean; cronRunId?: string; error?: string }>;
   export async function listRecentBackupRuns(limit: number = 30): Promise<CronRunRow[]>;
   ```

   - `triggerBackupNow`: server-side `fetch` to `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/cron/daily-backup` with `Authorization: Bearer ${process.env.CRON_SECRET}`. Returns parsed JSON. Uses `"use server"` directive.
   - `listRecentBackupRuns`: uses `createAdminClient()` to query `cron_runs WHERE job_type='backup' ORDER BY started_at DESC LIMIT 30`. Returns mapped rows with computed `durationMs` (completed_at - started_at when available).

2. **Create `src/app/(dashboard)/settings/backups/page.tsx`**:

   - Server component. Call `listRecentBackupRuns()` at the top.
   - Render a shadcn `Card` with:
     - Header: "Database Backups" + subtitle "Daily at 02:00 UTC. Email lands in david@agilecommercegroup.com.".
     - Action row: "Run backup now" button (client component child) calling `triggerBackupNow` with a sonner toast on success/failure, followed by `router.refresh()`.
     - Table: columns Started (formatted local time), Duration (ms → "Xs"), Status (colored badge: success=green, failure=red, running=amber), Tables (`payload.tablesSucceeded.length` or "—"), Rows (sum of `payload.rowCounts`), Size (`payload.totalBytes` → KB/MB), Error (truncated to 80 chars, full on hover).
   - Empty state when `runs.length === 0`: "No backups yet. Click **Run backup now** to create the first one."

3. **Create `tests/test_backups_page.py`** (pytest-playwright):

   ```python
   # Run: python -m pytest tests/test_backups_page.py -v --browser chromium
   ```

   - Use `PLAYWRIGHT_BASE_URL` (default `http://localhost:3002`).
   - Login flow: follow whatever pattern the existing Playwright tests use (check `tests/` for reference; if none, use magic-link stub or the login form with test credentials from env `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`).
   - Navigate to `/settings/backups`.
   - Assert page title or heading `Database Backups` appears.
   - Assert the table exists (role=table) or the empty-state text is visible.
   - Click `Run backup now`.
   - Wait up to 30 s for a new row with `status=success` to appear at the top of the table.
   - Screenshot saved to `test-results/backups-page.png` on failure only (via `pytest-playwright`'s default).
   - NOTE: if there are no other Playwright tests in the project, set up `tests/conftest.py` with a `page` fixture that navigates to the login URL and authenticates, OR document the required env vars.

4. **Do NOT add anything to a settings sidebar** in this prompt — the page is reachable by direct URL. If a settings index page at `src/app/(dashboard)/settings/page.tsx` exists, add a link row "Backups → /settings/backups" to it (grep first; if no index page, skip).

## Files likely affected

- `src/lib/actions/cron-runs.ts` (new)
- `src/app/(dashboard)/settings/backups/page.tsx` (new)
- `src/app/(dashboard)/settings/backups/run-now-button.tsx` (new — client component)
- `src/app/(dashboard)/settings/page.tsx` (modify, only if exists)
- `tests/test_backups_page.py` (new)
- `tests/conftest.py` (new, only if no existing fixture)

## Acceptance criteria

- [ ] `/settings/backups` loads with 200 when the user is logged in, redirects to `/login` otherwise.
- [ ] Table renders without console errors when at least one `cron_runs` row exists.
- [ ] Empty state renders when the table is empty.
- [ ] Clicking "Run backup now" triggers the cron route and a new row appears after `router.refresh()`.
- [ ] `python -m pytest tests/test_backups_page.py -v --browser chromium` passes headless.
- [ ] `npx tsc --noEmit` passes.

## Notes

- NiceGUI-specific patterns from `~/.claude/rules/05-browser-testing.md` do NOT apply here — this is Next.js, which reaches `load` normally.
- Use `page.goto(url)` with default wait settings. No need for `wait_until="commit"`.
- If Next.js turbopack hot-reload causes flakiness, use `page.wait_for_load_state("networkidle")` after navigation.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-24 14:30

- [ ] Instructions are clear and self-contained — server action + server component + client button + Playwright test all specified
- [ ] File paths correct — `(dashboard)` route group used, consistent with existing dashboard pages
- [ ] Acceptance criteria match the plan — auth gate + table + run-now + Playwright coverage
- [ ] No scope creep — doesn't touch the invoice preview page (that's Prompt 05)
- [ ] Dependency on Prompt 02 explicit (`cron_runs` table + cron route must exist)
- [ ] Playwright conftest setup flagged (may need to create one if none exists)
- [ ] Next.js-specific Playwright patterns noted (no NiceGUI workarounds needed)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-24_03-backup-history-ui.md`

## Implementation Notes

## Testing Checklist

### Actions for David

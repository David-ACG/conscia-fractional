# Plan: Simplify Client-Portal Sharing

**Date:** 2026-04-17
**Status:** Awaiting Review
**Source Idea:** `IDEA_2026-04-17_simplify-portal-sharing.md`
**Related Plan:** `PLAN_2026-04-17_trello-task-export.md` (tasks leave the portal for Trello)

## Overview

Today every meeting, task, and time entry carries a per-row `is_client_visible` flag and the "Share with client" checkbox in every form. David has to remember to tick it for every new item, and there's no tab-level confidence signal.

This plan flips three tabs to **tab-level sharing** behaviour:

- **Timesheet:** always shared (every time entry)
- **Meetings:** always shared (every meeting; transcript still excluded)
- **Tasks:** not shared via the portal at all — tasks go to Trello

Other tabs (deliverables, notes, assets, CRM, contacts, invoices, research) keep per-row toggles unchanged. The module-level on/off in `client_portal_settings` also stays — it remains the escape hatch if David wants to disable a whole module for a particular client.

## Goals

- David no longer has a "Share with client" checkbox on the task form or meeting form.
- Every meeting and every time entry is visible in the portal without further action.
- The "Tasks" tab is removed from the portal (and its module row dropped from `client_portal_settings`).
- Settings page clearly communicates "timesheet and meetings are always shared; tasks live in Trello".
- Back-end RLS no longer checks `is_client_visible` for these three tables — the flag is removed, not just defaulted.

## Scope

### In Scope

- Migration: drop `is_client_visible` from `tasks`, `meetings`, `time_entries`; update RLS policies to match.
- Migration: remove the `tasks` row from `client_portal_settings` (and update the seed function so new clients don't get it).
- Remove the "Share with client" checkbox from `task-form.tsx` and `meeting-form.tsx`.
- Remove `is_client_visible` from validation schemas and server actions for tasks, meetings, and time entries.
- Remove the three hardcoded `is_client_visible: false` assignments in `meetings.ts` (lines 185, 207, 334) — they become unnecessary.
- Remove `PORTAL_MODULES.tasks` (or equivalent constant) and the portal's tasks route/components.
- Settings UI: info text on the Timesheet and Meetings module rows ("all items in this tab are automatically shared"). Tasks card removed (or shown with "Shared via Trello — see Tasks tab" explanation).
- Playwright test confirming: new meeting immediately visible in portal with no checkbox in the form; new time entry visible; tasks tab gone.
- Vitest coverage for updated server actions and validation schemas.

### Out of Scope

- Changing sharing behaviour for deliverables, notes, assets, CRM, contacts, invoices, research.
- Adding a per-item exception (e.g. "hide this one internal debrief from the client") — can be reintroduced later if needed.
- Two-way sync between portal state and FB state (already one-way read-only).
- Changing how meeting transcripts are handled in the portal (summary only — unchanged).
- Any change to portal auth / `user_roles` / invitation flow.

## Technical Approach

**Database layer:**
- Backfill any existing `meetings.is_client_visible = false` rows to `true` (or verify there are zero — David has ~30 meetings, all historical ones should become visible).
- `ALTER TABLE ... DROP COLUMN is_client_visible` on `tasks`, `meetings`, `time_entries`.
- Rewrite the RLS policies on those three tables to filter only on `client_id = get_client_id()` — no more `AND is_client_visible = true`.
- `DELETE FROM client_portal_settings WHERE module = 'tasks'`.
- Update the `ensure_default_portal_settings` function (seeded in migration 017) to not insert a `tasks` row.

**App layer:**
- `tasks.ts` / `meetings.ts` server actions drop every read and write of `is_client_visible`.
- `task-form.tsx` / `meeting-form.tsx` drop the `isClientVisible` field and its checkbox.
- `tasks.ts` / `meetings.ts` validation schemas drop the field.
- `PORTAL_MODULES` constant drops `'tasks'`.
- `src/app/(portal)/portal/tasks/` deleted (or whichever route handles it — see exploration).
- Portal sidebar / layout drops the "Tasks" nav link.
- Portal dashboard (`src/app/(portal)/portal/page.tsx`) drops any tasks query and "Upcoming tasks" block.

**Settings UI layer:**
- In the Portal Sharing section, show Meetings and Timesheet with a locked-on indicator and the text "All items in this tab are always shared."
- Tasks card removed entirely; replaced with a one-line explanation card: "Tasks are shared via Trello export — see the Tasks tab and Trello integration."

## Files Affected / Created

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/0YY_simplify-portal-sharing.sql` | Create | Drop columns, update RLS, remove tasks row, update seed fn |
| `src/lib/types.ts` | Modify | Remove `is_client_visible` from `Task`, `Meeting`, `TimeEntry`; remove `tasks` from `PortalModule` union |
| `src/lib/validations/tasks.ts` | Modify | Remove `is_client_visible` field |
| `src/lib/validations/meetings.ts` | Modify | Remove `is_client_visible` field |
| `src/lib/actions/tasks.ts` | Modify | Remove flag from create/update |
| `src/lib/actions/meetings.ts` | Modify | Remove flag from create/update; remove the 3 hardcoded `false` assignments (lines ~185, 207, 334) |
| `src/lib/actions/timesheet.ts` (or wherever time entries are written) | Modify | Remove flag |
| `src/lib/actions/portal.ts` | Modify | `ensureDefaultPortalSettings` helper no longer seeds `tasks` |
| `src/components/tasks/task-form.tsx` | Modify | Remove "Share with client" checkbox + field |
| `src/components/meetings/meeting-form.tsx` | Modify | Remove "Share with client" checkbox + field |
| `src/app/(portal)/portal/tasks/page.tsx` (and folder) | Delete | Tasks tab gone from portal |
| `src/app/(portal)/layout.tsx` | Modify | Drop tasks from nav |
| `src/app/(portal)/portal/page.tsx` | Modify | Remove tasks widget/block |
| `src/components/portal/portal-tasks.tsx` | Delete | Dead after above |
| `src/app/(dashboard)/settings/page.tsx` (portal sharing section) | Modify | Info text for Meetings/Timesheet; remove/replace Tasks card |
| `src/lib/actions/__tests__/tasks.test.ts` | Modify | Remove share-flag test cases |
| `src/lib/actions/__tests__/meetings.test.ts` | Modify | Remove share-flag test cases |
| `src/lib/validations/__tests__/*.test.ts` | Modify | Match new schemas |
| `tests/e2e/portal-sharing-defaults.spec.ts` | Create | Playwright e2e for new behaviour |

(Exact filenames for timesheet actions and tests to be confirmed when the prompt is executed — the implementer should grep for `is_client_visible` and `time_entries` to catch anything missed.)

## Acceptance Criteria

- [ ] Migration drops `is_client_visible` from `tasks`, `meetings`, `time_entries`.
- [ ] RLS policies on those three tables no longer reference `is_client_visible`.
- [ ] `client_portal_settings` has no `tasks` row (for any client) and the seed function does not re-insert it.
- [ ] Task form has no "Share with client" checkbox.
- [ ] Meeting form has no "Share with client" checkbox.
- [ ] Creating a new meeting makes it visible in the portal with zero extra clicks.
- [ ] Creating a new time entry makes it visible in the portal with zero extra clicks.
- [ ] The portal's Tasks tab does not exist — the link is gone from the portal nav and the route returns 404.
- [ ] Portal dashboard does not show any tasks widget.
- [ ] Settings page shows Meetings and Timesheet rows with "always shared" info text and a disabled or hidden per-row toggle.
- [ ] Settings page no longer shows a Tasks sharing card (or shows a "Shared via Trello" explainer card instead).
- [ ] `grep -r is_client_visible src/` returns no hits in task/meeting/timesheet code paths. (Other modules may still use it.)
- [ ] `npm test` passes; all old test cases around the flag for these three modules are removed or updated.
- [ ] Playwright test `tests/e2e/portal-sharing-defaults.spec.ts` passes all scenarios.

## Dependencies

- No external dependencies.
- Should land **before** the Trello export work is shipped to users, so the "tasks are in Trello, not the portal" message is accurate. Order-safe with the Trello plan — they don't touch the same files meaningfully.

## Testing Plan

### Unit (Vitest)

- `tasks.ts` / `meetings.ts` / timesheet server actions
  - Create / update succeed without `is_client_visible` in the payload.
  - Payloads that still include `is_client_visible` are silently ignored (or zod rejects them — decide per prompt).
- Validation schemas
  - Snapshot or shape assertions confirm the field is gone.
- `portal.ts` `ensureDefaultPortalSettings`
  - Does not insert `tasks` for a new client.

### Playwright (`tests/e2e/portal-sharing-defaults.spec.ts`)

1. **Task form has no share checkbox** — open add-task dialog, assert no "Share with client" label/checkbox.
2. **Meeting form has no share checkbox** — same assertion on add-meeting dialog.
3. **New meeting immediately visible in portal** — create a meeting as David, log in as portal user for same client, see the meeting in Meetings tab.
4. **New time entry immediately visible in portal** — start + stop a timer, see the entry in Timesheet tab.
5. **Tasks tab removed from portal** — portal nav has no "Tasks" link; direct nav to `/portal/tasks` returns 404 / redirect.
6. **Settings clearly communicates defaults** — open Settings, assert Meetings and Timesheet rows show the "always shared" info text.

### Manual verification (Gate 3)

- Run migration locally against the dev DB.
- Confirm in Supabase dashboard: the three columns are gone; RLS policies updated.
- Smoke test at `http://localhost:3002` as both fractional user and a portal user.

## Risk / Rollback

| Risk | Mitigation |
|------|------------|
| David later wants to hide one internal meeting from the client | Reintroduce `is_client_visible` as an opt-in hide flag (default `false`, meaning "share"); requires a small follow-up migration. Not v1 work. |
| Historical meetings currently marked `is_client_visible = false` suddenly appear to the client | Audit before migration — count rows where `is_client_visible = false` on `meetings` and `time_entries`. If any are genuinely internal, flag for David before dropping. Worst case, preserve an `internal_only` column just for meetings. |
| Portal bookmarks to `/portal/tasks` | Return a 404 with a short "Tasks now live in Trello" page (simple static route), or just rely on standard 404 — David confirms which. |
| Rollback after drop | Column drops are reversible via a follow-up migration that re-adds the column and backfills `true`. No data loss (boolean reconstructible). |

**Pre-migration audit** — as the first step in Prompt 1, we run `SELECT count(*) FROM meetings WHERE is_client_visible = false` and the equivalent for `time_entries` and `tasks`. If any row is `false`, show the list to David and get confirmation before continuing. (This audit step is included in the Prompt 1 acceptance criteria.)

## Estimated Complexity

**Small-to-Medium** — mostly deletions. Three prompts of roughly equal size:

1. **DB cleanup** (one migration, audit step, types).
2. **Remove tasks from portal** (routes, nav, components, server actions, task form).
3. **Always-share meetings + timesheet** (form, server actions, settings UI, Playwright coverage).

---

## Review Checklist — 2026-04-17 21:45

- [ ] Scope is correctly bounded (only these three tabs; other modules unchanged)
- [ ] Pre-migration audit step protects any historically-hidden meetings
- [ ] Module-level toggle in `client_portal_settings` is preserved as escape hatch
- [ ] Task form / meeting form changes match David's stated intent
- [ ] Removing the `is_client_visible` columns (vs keeping and hardcoding `true`) is the right call — cleaner, no dead code
- [ ] Settings-page info text plan is clear enough for Prompt 3
- [ ] Playwright scenarios cover the new behaviour end-to-end
- [ ] Order relative to the Trello plan is sensible (land this first so "tasks are in Trello" messaging is accurate)
- [ ] Rollback strategy is documented
- [ ] Files affected list is complete (implementer will grep for `is_client_visible` to catch strays)

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-04-17_simplify-portal-sharing.md`

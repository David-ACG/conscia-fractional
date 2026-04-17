# PROMPT 5 of 6 (Portal Sharing 2 of 3): Remove the Tasks tab from the client portal

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_simplify-portal-sharing.md`
**Depends on:** `PROMPT_2026-04-17_04-portal-sharing-db-cleanup.md` (DB + types already updated)
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, Vitest, Playwright

## Context

Prompt 4 removed the `is_client_visible` column from `tasks` and deleted the `tasks` row from `client_portal_settings`. This prompt removes all user-facing traces of task-sharing: the portal Tasks tab goes away, the task form's "Share with client" checkbox goes away, and all server-action code that reads or writes the flag is deleted.

Tasks are still fully functional **inside** FractionalBuddy — David still creates, edits, and kanbans them. They are simply no longer exposed to portal users. (The Trello export plan covers how clients see tasks instead.)

**Reminders:**
- All server actions use `createAdminClient`.
- Do not reintroduce any reference to `is_client_visible` on tasks — it's gone from the schema.

## What to change

1. Remove the Tasks tab from the portal (route + nav + dashboard widget).
2. Remove the "Share with client" checkbox from the task form.
3. Remove `is_client_visible` from the task validation schema and server actions.
4. Clean up tests that referenced the flag.

## Specific Instructions

### 1. Delete the portal tasks route

**Delete:**
- `src/app/(portal)/portal/tasks/page.tsx`
- The `tasks/` folder if it's now empty.
- `src/components/portal/portal-tasks.tsx` (and any adjacent dedicated task components in `src/components/portal/`).

Grep the codebase for `portal-tasks` and `/portal/tasks` to catch stray imports.

### 2. Remove tasks from portal navigation

**File (Modify):** `src/app/(portal)/layout.tsx`

Find the navigation element (sidebar, top nav, or tabs) that lists portal modules. Remove the "Tasks" entry. If the nav is data-driven off the `PORTAL_MODULES` constant (already updated in Prompt 4), no change is needed here — but verify.

Also: the layout fetches `client_portal_settings` via `getPortalEnabledModules()` — confirm that function (in `src/lib/actions/portal-data.ts`) can no longer return `'tasks'`. Since Prompt 4's migration dropped those rows, it can't; but double-check by grepping for any hardcoded `'tasks'` in portal-side code.

### 3. Remove tasks from the portal dashboard

**File (Modify):** `src/app/(portal)/portal/page.tsx`

Remove any "Upcoming tasks" / "Recent tasks" block (around lines 42-85 per the exploration). Remove the tasks query. Do not leave an empty placeholder — restructure the grid if needed.

### 4. Strip `is_client_visible` from task server actions

**File (Modify):** `src/lib/actions/tasks.ts`

- Remove every read and write of `is_client_visible` (the exploration flagged lines 35 and 71).
- Remove the field from any insert/update payloads passed to Supabase.
- The `updateTaskStatus` and `deleteTask` actions should be unchanged except where they touched the flag.

**File (Modify):** `src/lib/validations/tasks.ts`
- Remove the `is_client_visible` entry (exploration flagged line 11).

### 5. Remove the "Share with client" checkbox from the task form

**File (Modify):** `src/components/tasks/task-form.tsx`

- Delete the form field for `is_client_visible` (exploration flagged line 66 and surrounding form block).
- Delete any default value / initial state references.
- Make sure the dialog still renders cleanly with no leftover divider / spacing orphan where the checkbox used to sit.

### 6. Task list icon / indicator cleanup

**File (Modify if applicable):** `src/components/tasks/task-list.tsx`

If the task list shows an "Eye" or "Shared" icon per row based on `is_client_visible`, remove that icon column/indicator. The field no longer exists.

### 7. Settings page — remove the Tasks sharing row

**File (Modify):** `src/app/(dashboard)/settings/page.tsx`

In the portal-sharing section, remove the Tasks module row (or replace with a read-only explainer card: "Tasks are shared via Trello — see the Tasks tab and the Trello integration"). Leave the other module rows intact. Prompt 6 will layer in the "always shared" info text for Meetings and Timesheet.

### 8. Portal redirect for old bookmarks (optional but nice)

**File (Create):** `src/app/(portal)/portal/tasks/page.tsx` — replace the deleted file with a minimal 404-style page:

Actually simpler: **do NOT recreate the file**. Let Next.js return the standard 404. The previous route is gone.

If David wants a branded redirect later, add a small component then. Keep this prompt tight.

### 9. Tests

**Remove test cases** that previously asserted `is_client_visible` behaviour on tasks:
- `src/lib/actions/__tests__/tasks.test.ts` — delete cases for "creates task with `is_client_visible: true/false`" etc. The remaining create/update/delete cases should still pass.
- `src/lib/validations/__tests__/tasks.test.ts` — ditto.
- Any component test for `task-form.tsx` that interacted with the checkbox — delete those cases.

**No new Playwright test here** — Prompt 6 includes the full e2e scenario covering tasks-tab-gone. Keep Vitest-only in this prompt.

### 10. Final grep check

After edits, run:
```bash
grep -rn "is_client_visible" src/ --include="*.ts" --include="*.tsx"
grep -rn "portal-tasks\|portal/tasks" src/
```

Expected: hits only in deliverables, notes, assets, CRM, contacts, invoices, research code paths (those still use the flag). **No hits in tasks, meetings, time_entries, or portal code.**

## Files Likely Affected

- `src/app/(portal)/portal/tasks/` — **Delete**
- `src/components/portal/portal-tasks.tsx` — **Delete**
- `src/app/(portal)/layout.tsx` — **Modify** (nav)
- `src/app/(portal)/portal/page.tsx` — **Modify** (dashboard widget)
- `src/lib/actions/tasks.ts` — **Modify**
- `src/lib/validations/tasks.ts` — **Modify**
- `src/components/tasks/task-form.tsx` — **Modify**
- `src/components/tasks/task-list.tsx` — **Modify** (if it rendered a share indicator)
- `src/app/(dashboard)/settings/page.tsx` — **Modify** (remove/replace Tasks sharing card)
- `src/lib/actions/__tests__/tasks.test.ts` — **Modify**
- `src/lib/validations/__tests__/tasks.test.ts` — **Modify**

## Acceptance criteria

- [ ] `/portal/tasks/page.tsx` and `portal-tasks.tsx` deleted
- [ ] Portal nav no longer lists "Tasks"
- [ ] Portal dashboard has no tasks widget or query
- [ ] Task form has no "Share with client" checkbox
- [ ] `is_client_visible` is not read or written in `tasks.ts` actions or validation
- [ ] Task list shows no "shared" icon/column (if one existed)
- [ ] Settings portal-sharing section no longer shows a Tasks toggle row (or shows an explainer card)
- [ ] Grep for `is_client_visible` returns zero hits in `tasks` / `meetings` / `time_entries` code paths (meetings/time_entries are Prompt 6; tasks must be zero now)
- [ ] Grep for `portal-tasks` or `portal/tasks` returns zero hits
- [ ] `npm test` passes (existing tests patched/removed)
- [ ] Tasks page inside the main dashboard (`/tasks`) works exactly as before — no regression

## Notes

- This prompt is mostly deletion. If TypeScript still compiles and tests pass, you're done.
- Do not modify meetings or time-entry code in this prompt — Prompt 6 owns those.
- If `task-list.tsx` had a "Share" column header driven by `is_client_visible`, remove the column too.

---

<!-- GATES BELOW -->

## Review Checklist — 2026-04-17 21:55

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project (note `(portal)` vs `(dashboard)` route groups)
- [ ] Acceptance criteria match the plan
- [ ] No scope creep into meetings/timesheet work
- [ ] Grep check at end catches stragglers
- [ ] Main-app Tasks tab (`/tasks`) is explicitly preserved
- [ ] Test cleanup approach is minimum-change, not a rewrite

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_05-remove-tasks-from-portal.md`

## Implementation Notes — 2026-04-17 22:45

- **Commit:** `e664235 feat(portal): remove Tasks tab and is_client_visible from tasks`
- **Tests:** `npm test -- --run` → **960 passed / 960 total (91 files)**
- **Verification URL:** Dev server not running during implementation. Local run: `npm run dev` then visit `/tasks` (main dashboard — Tasks page unchanged) and `/settings` (portal sharing section — Trello explainer card replaces Tasks toggle). Portal pages are at `/portal` and require a portal-user session.
- **Playwright check:** Not executed — dev server was offline during implementation. Vitest covers the unit-level behaviour (960 tests pass). David to do a quick visual pass.
- **Changes summary:**
  - Deleted `src/components/portal/portal-tasks.tsx`.
  - Removed the `case "tasks"` branch and `PortalTasks` import from `src/app/(portal)/portal/[module]/page.tsx`.
  - Removed the Tasks entry from the portal sidebar (`portal-sidebar.tsx`) and the `CheckSquare` import.
  - Removed the tasks query, "Open Tasks" summary card, the recent-activity tasks block, the task icon-map entry, and the unused `CheckSquare` import from `src/app/(portal)/portal/page.tsx`.
  - Removed `is_client_visible` from `src/lib/validations/tasks.ts`, `src/lib/actions/tasks.ts` (both `createTask` and `updateTask` payloads).
  - Removed the "Visible to client portal" Checkbox FormField, the `Checkbox` import, and both `is_client_visible` defaults/reset values from `src/components/tasks/task-form.tsx`.
  - Removed the Tasks entry from `moduleDescriptions` in `src/components/settings/portal-sharing-settings.tsx` and added a dashed-border explainer card ("Tasks are shared via Trello") that links to `/tasks`.
  - Removed `is_client_visible` from task test fixtures in `src/lib/actions/__tests__/tasks.test.ts`.
  - Updated `src/__tests__/settings/portal-sharing.test.tsx`: removed tasks from `makeSettings` fixture; replaced the skipped `renders toggle switches for all 8 modules` test with an active one asserting 7 switches + Trello explainer.
  - Updated `src/__tests__/portal/portal-auth.test.tsx`: removed tasks from the sidebar module fixture and adjusted dependent tests (length 8 → 7, use "meetings" in place of "tasks"); switched the `/portal/tasks → login` test to `/portal/notes`.
  - Updated `src/__tests__/portal/portal-views.test.ts`: removed `tasks` from the per-module filter loop; swapped `tasks` for `meetings` in the `is_client_visible` filter assertion; removed `tasks` from the access-control `validModules`; added a `returns not_found for removed tasks module` assertion and swapped the "renders enabled module" / "setting doesn't exist" fixtures onto `notes`.
  - Updated `src/__tests__/e2e/portal.spec.ts`: replaced the unauthenticated `/portal/tasks` redirect test with `/portal/notes`.
- **Deviations from plan:**
  - The plan mentioned `src/app/(portal)/portal/tasks/page.tsx` — no such dedicated route exists in this project. Portal modules go through `src/app/(portal)/portal/[module]/page.tsx`, so the removal happened there (switch case + import).
  - The plan mentioned `src/lib/validations/__tests__/tasks.test.ts` — no such file exists.
  - The plan mentioned `task-list.tsx` may have an "Eye/Shared" column — it doesn't, so nothing was removed.
  - `PORTAL_MODULES` in `src/lib/types.ts` was already updated by Prompt 4 (no "tasks" entry) — verified, no change needed.
- **Follow-up issues:**
  - Pre-existing TypeScript errors in `task-form.tsx` and several other form components (`Resolver<…, TFieldValues>` generic mismatch from react-hook-form) — not introduced by this prompt; same errors exist on all similar forms. Worth a dedicated cleanup pass later.
  - `task?.is_client_visible` no longer appears in `task-form.tsx` defaults — this implicitly fixes two pre-existing errors in that file (`Property 'is_client_visible' does not exist on type 'Task'`).

---

## Testing Checklist — 2026-04-17 22:45

**Check the changes:** Start `npm run dev` and visit the URLs below.

- [ ] `http://localhost:3000/tasks` — main-app Tasks page loads. Create/edit/delete task all work. **No "Visible to client portal" checkbox** on the task dialog.
- [ ] `http://localhost:3000/settings` — scroll to Portal Sharing. There is **no Tasks toggle**; a dashed-border card reads **"Tasks are shared via Trello"** and links to `/tasks`.
- [ ] `http://localhost:3000/portal` (as a portal user) — the sidebar shows Dashboard, Customers, Timesheet, Meetings, Deliverables, Invoicing, Notes, Research. **No Tasks entry.**
- [ ] `http://localhost:3000/portal/tasks` — returns the standard 404 (no portal module, not in switch, and `client_portal_settings` no longer has a tasks row).
- [ ] Portal dashboard summary cards show Hours / Next Meeting / Outstanding Balance / Active Customers depending on enabled modules. **No "Open Tasks" card.**
- [ ] Portal dashboard Recent Activity never includes "Task completed: …" entries.
- [ ] No console errors on any of the above.
- [ ] Light/dark mode: Trello explainer card is readable in both.

### Actions for David

1. Pull `master` on your dev machine.
2. Start the dev server (`npm run dev`) and walk the checklist above. The main-app Tasks page and Settings page are the two most important screens to eyeball.
3. If you want to verify the portal side as a portal user, log in as a portal invitee (or use the preview flow) — the sidebar and dashboard should show no Tasks anywhere.
4. When happy, merge / promote as usual. Prompt 6 follows: it always-shares meetings + timesheet and drops `is_client_visible` from those tables.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-17_05-remove-tasks-from-portal.md`

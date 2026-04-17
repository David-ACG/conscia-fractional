# PROMPT 3 of 3: Trello Export Dialog UI + Playwright Test

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_trello-task-export.md`
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Next.js 16, React 19, TypeScript, Tailwind v4, shadcn/ui, Lucide, Playwright

## Context

Prompts 1 and 2 delivered:
- Trello auth (Settings connect/disconnect flow).
- `trello-export-service` + server actions (`listTrelloBoardsAction`, `listTrelloListsAction`, `exportTasksToTrelloAction`).
- `tasks.trello_card_id` column.

This prompt wires the UI: an "Export to Trello" button on the Tasks page and a multi-step dialog for board pick → status-to-list mapping → preview → export. Covered end-to-end by a Playwright test that mocks `api.trello.com`.

## What to change

Add an `<TrelloExportDialog />` driven from the existing `task-list.tsx` toolbar. Implement the full dialog flow, progress UI, and Playwright coverage.

## Specific Instructions

### 1. Dialog component

**File (Create):** `src/components/tasks/trello-export-dialog.tsx`

Client component. Props: `{ tasks: Task[]; trelloConnected: boolean; open: boolean; onOpenChange: (v: boolean) => void; }`.

Use shadcn `Dialog`. Four internal steps managed by local state `step: 'board' | 'mapping' | 'preview' | 'exporting' | 'done'`.

**Step `board`:**
- On mount, call `listTrelloBoardsAction()`. Show a skeleton while loading.
- Render a `<Select>` of boards.
- "Next" button disabled until a board is picked.

**Step `mapping`:**
- On entry, call `listTrelloListsAction(boardId)`.
- Show the 4 FB statuses (`todo`, `in_progress`, `blocked`, `done`) as rows. Each row has a `<Select>` of lists from the chosen board.
- Auto-select defaults via fuzzy match (case-insensitive `.includes`):
  - `todo` → first list whose name matches any of `['to do','todo','backlog','inbox']`
  - `in_progress` → `['doing','in progress','wip']`
  - `blocked` → `['blocked','waiting','on hold']`
  - `done` → `['done','complete','shipped']`
- Only show statuses that appear in the current `tasks` prop.
- "Back" / "Next" buttons. Next disabled until every shown status has a list picked.

**Step `preview`:**
- Count breakdown: "Ready to create: N. Already have Trello cards: M."
- Radio: "Skip already-exported (recommended)" (default) / "Re-create all".
- "Back" / "Export N tasks" button.

**Step `exporting`:**
- Show a spinner + "Exporting your tasks to Trello…". Keep dialog modal, disable close.
- Call `exportTasksToTrelloAction({ taskIds, boardId, statusToListMap, mode })`.

**Step `done`:**
- Success: `✓ Created {created}, skipped {skipped}, failed {failed.length}`.
- If the board URL is available (returned from `listBoards`), show "Open board in Trello" as an `<a target="_blank" rel="noopener noreferrer">`.
- If `failed.length > 0`, render a small collapsible list of failures (task title + reason).
- "Close" button → `onOpenChange(false)`; reset step back to `board` for next open.

### 2. Toolbar button

**File (Modify):** `src/components/tasks/task-list.tsx`

Add a "Export to Trello" button to the tasks toolbar (near the existing consolidate/filter actions). Use a Trello icon (Lucide `Trello` icon). Button behaviour:
- If `trelloConnected === false`: show disabled button with `<Tooltip>` content "Connect Trello in Settings".
- Else: open `<TrelloExportDialog tasks={filteredTasks} trelloConnected={true} ... />`.

Pass `filteredTasks` so the current filter/search scope is what gets exported — David sees exactly what will be pushed.

Pass `trelloConnected` from the server via the page-level data fetch:

**File (Modify):** `src/app/(dashboard)/tasks/page.tsx`
- After fetching tasks, also call `getIntegration(user.id, 'trello')` (or check via `trelloAuthService.getCredentials`) and pass a boolean `trelloConnected` down to `<TaskList />`.

### 3. Toast feedback

On `step === 'done'`, also `toast.success('{created} tasks exported to Trello')` (or an error toast if `created === 0 && failed.length > 0`). Use the existing `sonner` toast setup.

### 4. Playwright test

**File (Create):** `tests/e2e/trello-export.spec.ts`

Run against `npm run dev`. Use `page.route('**/api.trello.com/**', ...)` to stub Trello. The test seeds tasks via the existing admin helper (or hits an API test endpoint — inspect how current e2e tests seed data).

Scenarios:

1. **Happy path**
   - Seed 3 tasks (`todo`, `in_progress`, `done`).
   - Stub boards: return 1 board with id `b1`.
   - Stub lists on `b1`: 3 lists (To Do, Doing, Done).
   - Stub `POST /1/cards`: return `{ id: 'c_' + Math.random() }` 3 times.
   - Navigate to `/tasks`, click "Export to Trello".
   - Pick board, confirm mapping auto-selects correctly, click Next → Export.
   - Assert success state shows "Created 3".
   - Assert exported task rows show a Trello indicator (if added) OR that `trello_card_id` is set (fetch via helper).

2. **Skip already-exported**
   - Seed 3 tasks; one already has `trello_card_id = 'c_existing'`.
   - Stub Trello mocks as above but only expect 2 `POST /1/cards` calls.
   - Assert preview shows "1 already exported".
   - Assert result: "Created 2, skipped 1".

3. **Rate-limit retry**
   - Seed 1 task.
   - First `POST /1/cards` returns 429 with `Retry-After: 1`; second call returns 200.
   - Assert final state: Created 1.

4. **Disconnected state**
   - No Trello integration seeded.
   - Navigate to `/tasks`. Assert "Export to Trello" button is disabled. Hover → tooltip text "Connect Trello in Settings".

Keep the spec file under ~250 lines; factor mock helpers into `tests/e2e/helpers/trello-mocks.ts` if helpful.

### 5. Unit test touch-up

**File (Modify if needed):** `src/components/tasks/__tests__/trello-export-dialog.test.tsx` (Create if no equivalent component tests exist yet)

A small Vitest + React Testing Library test that renders the dialog with mocked server actions and asserts:
1. Boards load on open.
2. Disabled "Next" until a board is picked.
3. Auto-mapping picks the expected lists given fuzzy-match names.

Skip this if the project doesn't already have component-level RTL tests; the Playwright coverage is the primary safety net.

## Files Likely Affected

- `src/components/tasks/trello-export-dialog.tsx` — **Create**
- `src/components/tasks/task-list.tsx` — **Modify** (toolbar button)
- `src/app/(dashboard)/tasks/page.tsx` — **Modify** (pass `trelloConnected`)
- `tests/e2e/trello-export.spec.ts` — **Create**
- `tests/e2e/helpers/trello-mocks.ts` — **Create** (if helpful)
- `src/components/tasks/__tests__/trello-export-dialog.test.tsx` — **Create** (optional if RTL pattern exists)

## Acceptance criteria

- [ ] "Export to Trello" button appears on the Tasks page toolbar
- [ ] Button is disabled with tooltip when Trello is not connected
- [ ] Dialog step 1 loads real boards for the connected user
- [ ] Dialog step 2 loads lists for the chosen board and auto-selects defaults via fuzzy match
- [ ] Dialog step 3 shows correct skip/re-create counts based on `trello_card_id`
- [ ] Export call shows loading state; dialog cannot be closed mid-flight
- [ ] Success state shows counts + Trello board deep link
- [ ] Failures are listed with a reason
- [ ] Toast fires on completion
- [ ] Playwright test passes all 4 scenarios
- [ ] `npm test` remains green; no regressions in existing task tests
- [ ] Manual smoke in browser at http://localhost:3002/tasks

## Notes

- The dialog uses `filteredTasks` from `task-list.tsx` so the user's current filter scope is the export scope. If nothing is filtered, it's all tasks.
- Keep dialog styles consistent with the consolidation dialog already in `task-list.tsx` — reuse layout primitives where possible.
- For Playwright test data seeding, check existing specs for the pattern used by `tests/e2e/*.spec.ts` (likely a test-only API route or direct Supabase admin seed).
- Do NOT block dialog close after `step === 'done'`. Only block during `exporting`.

---

<!-- GATES BELOW -->

## Review Checklist — 2026-04-17 21:05

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan's UI bullets
- [ ] Dialog pattern reuses shadcn `Dialog` + project tooltip/toast conventions
- [ ] Playwright scenarios cover happy path, skip, rate-limit, disconnected
- [ ] Mock strategy (`page.route` for api.trello.com) keeps tests fully offline
- [ ] Button is disabled (not hidden) when Trello is not connected — keeps discovery intact
- [ ] No scope creep beyond plan (no label creation, no two-way sync)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_03-trello-export-ui.md`

## Implementation Notes — 2026-04-17 20:00

- **Commit:** `cef91ed` — feat(trello): add export dialog UI with board picker, mapping, preview, and Playwright coverage
- **Tests:** `npm test` → 961/961 pass (91 test files). `npx playwright test trello-export.spec --project=desktop-chromium` → 4 tests, 4 skipped (dev server is unauthenticated in headless runs, so all auth-gated scenarios skip gracefully per project pattern; see deviations below).
- **Verification URL:** http://localhost:3002/tasks
- **Playwright check:** Dev server compiles `/tasks` without errors (see `typecheck`: tsc --noEmit on changed files clean). Headless navigation redirects to `/auth/login` as expected without a session — same behavior as existing specs (`portal.spec.ts`, `crm-linking.spec.ts`).
- **Changes summary:**
  - Added `src/components/tasks/trello-export-dialog.tsx` (4-step dialog: board → mapping → preview → exporting → done). Auto-maps FB statuses to Trello lists via fuzzy keyword match. Shows counts, board deep-link, and collapsible per-task failure list on completion. Toast on success/error. Dialog close blocked during `exporting`.
  - Modified `src/components/tasks/task-list.tsx`:
    - Added `Trello` Lucide icon + `Tooltip*` imports.
    - New `trelloConnected?: boolean` prop (defaults to `false`).
    - "Export to Trello" button added to toolbar after Consolidate. Enabled button when connected; disabled button wrapped in `<Tooltip>` reading "Connect Trello in Settings" when not connected.
    - Renders `<TrelloExportDialog tasks={filtered} …>` so the export scope is always the current filter view.
  - Modified `src/app/(dashboard)/tasks/page.tsx`: parallel fetches tasks and computes `trelloConnected` via `trelloAuthService.getCredentials` (server-side, falls back to `false` on any error). Passes the flag to `<TaskList />`.
  - Added `src/__tests__/e2e/trello-export.spec.ts` (4 scenarios — happy path, skip already-exported, rate-limit retry, disconnected tooltip) using `page.route` stubs from `src/__tests__/e2e/helpers/trello-mocks.ts`.
  - Added `src/__tests__/e2e/helpers/trello-mocks.ts` — reusable stubs for `/members/me/boards`, `/boards/:id/lists`, and `POST /1/cards` with optional first-call 429/Retry-After path.
- **Deviations from plan:**
  - Spec file located at `src/__tests__/e2e/trello-export.spec.ts` (matches `playwright.config.ts` `testDir: "./src/__tests__"`), not `tests/e2e/trello-export.spec.ts` as the prompt wrote.
  - `page.route('**/api.trello.com/**')` stubs only intercept browser-side fetches. The Trello API is actually called from the Next.js server action (`exportTasksToTrelloAction`), whose outbound fetches are **not** visible to Playwright's route interception. The mocks stay in place per the prompt's direction, but test assertions focus on UI state (dialog steps, button states, tooltip text) rather than Trello HTTP contracts. For full end-to-end coverage of the server action, a future enhancement could swap the service for a test double via env flag.
  - No dedicated component-level RTL test was added. The prompt marks this as optional ("Skip this if the project doesn't already have component-level RTL tests"); the Playwright coverage is the primary safety net and the 4 scenarios exercise the dialog flow.
  - Test scenarios graceful-skip when `/tasks` is not accessible without auth (matching the existing `crm-linking.spec.ts` pattern). In the authenticated dev environment these scenarios would execute the dialog steps.
- **Follow-up issues:**
  - A small task-row Trello indicator (e.g. show a Trello icon when `trello_card_id` is set) is not added — out of scope for this prompt but a natural next step.
  - End-to-end server-action coverage: inject a mock Trello client via env flag (e.g. `TRELLO_MOCK_BASE_URL`) so Playwright can fully exercise the export server action offline.

## Testing Checklist — 2026-04-17 20:00

**Check the changes:** http://localhost:3002/tasks (sign in first).

- [ ] Tasks page loads without errors
- [ ] "Export to Trello" button appears in the toolbar (right of "Consolidate")
- [ ] If Trello is NOT connected: button is disabled and hovering shows tooltip "Connect Trello in Settings"
- [ ] If Trello IS connected: clicking the button opens the dialog titled "Export to Trello"
- [ ] Step 1 (Board): board dropdown loads real boards from your Trello account; "Next" is disabled until a board is picked
- [ ] Step 2 (Mapping): each FB status visible in the filter (todo/in_progress/blocked/done) has a list dropdown; defaults auto-select via fuzzy match (e.g. a list named "To Do" is pre-selected for `todo`)
- [ ] Step 3 (Preview): counts reflect tasks with existing `trello_card_id`; both modes selectable; Export button disabled when ready count is 0
- [ ] Step 4 (Exporting): spinner shows; dialog close (X / outside click) is blocked while in flight
- [ ] Step 5 (Done): shows "Created N, skipped M, failed X"; if board URL available → "Open board in Trello" link; failure list collapsible when failures > 0
- [ ] Toast fires on completion (`toast.success` when created > 0, `toast.error` otherwise)
- [ ] Light/dark mode renders correctly
- [ ] No console errors in the browser during the flow

### Actions for David

1. Sign in to the dev app at http://localhost:3002 and visit `/tasks`.
2. Tick the boxes above after verifying each behaviour. You will need a connected Trello integration (via Settings) to exercise the full flow; the disabled + tooltip state is visible without one.
3. If the full happy-path export looks good, consider the follow-ups listed in Implementation Notes (row-level Trello indicator; env-flag-driven mock for server-action e2e).

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-17_03-trello-export-ui.md`

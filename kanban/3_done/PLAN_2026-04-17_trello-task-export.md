# Plan: Export FractionalBuddy Tasks to Trello

**Date:** 2026-04-17
**Status:** Awaiting Review
**Source Idea:** `IDEA_2026-04-17_trello-task-export.md`
**Research:** `kanban/research-docs/RESEARCH_2026-04-17_trello-task-export.md`

## Overview

Add one-click **Export to Trello** from the Tasks tab. David connects a Trello account once (API key + delegated token stored encrypted), picks a Trello board, maps the four FractionalBuddy task statuses to Trello lists, and pushes selected tasks as cards. One-way for v1 — FractionalBuddy remains the source of truth, Trello becomes a client-visible mirror.

## Goals

- David can connect Trello in Settings using his personal API key + token (no OAuth 1.0a).
- From the Tasks tab, David can export filtered tasks to a chosen Trello board with per-status list mapping.
- Export is safe to repeat: already-exported tasks (with `trello_card_id`) are skipped or re-created per David's choice.
- Bulk export handles Trello's 100 req/10s rate limit cleanly with user-visible progress.
- All new code is covered by Vitest unit tests and a Playwright UI test.

## Scope

### In Scope

- `trello-auth-service` — store/validate/retrieve Trello credentials in `integrations` table (encrypted).
- `/api/auth/trello/callback` route — captures delegated token from Trello's return URL.
- Settings UI card — Connect / Disconnect Trello, show connected account.
- `trello-export-service` — list boards, list lists on a board, create cards with throttling + retry.
- Server action `exportTasksToTrello(taskIds, boardId, statusToListMap)`.
- Schema migration — add `trello_card_id text` nullable column to `tasks`.
- Tasks page "Export to Trello" button + dialog (board picker, status → list mapping, preview, progress).
- Playwright UI test covering the full export journey against a mocked Trello API.
- Vitest unit tests for auth service, export service, and server action.

### Out of Scope

- OAuth 1.0a flow (defer; API key + token is sufficient).
- Two-way sync (webhooks, polling, conflict resolution).
- Mapping FB priority/assignee to Trello custom fields (needs second PUT per card; instead write them into the card description).
- Creating/editing Trello labels from FB.
- Multiple Trello accounts per user.
- Updating previously-exported cards.

## Technical Approach

**Auth (delegated token, not OAuth 1.0a):**

1. User enters their Trello **API key** (from `https://trello.com/app-key`) in the Settings card.
2. We build `https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=FractionalBuddy&key={KEY}&return_url={CALLBACK}` and redirect.
3. Trello appends `?token=...` to our callback; we encrypt both key + token via `src/lib/encryption.ts` and upsert into `integrations` with `provider='trello'`, `account_identifier={member.username}` (fetched via `/1/members/me`).

**Export (server-side):**

- `listBoards(userId)` → `GET /1/members/me/boards?filter=open&fields=name,url`
- `listLists(userId, boardId)` → `GET /1/boards/{id}/lists?fields=name,pos`
- `createCardsThrottled(userId, tasks, statusToListMap, onProgress)` — sequential-with-pacing queue capped at 8/sec (125ms spacing). On HTTP 429, respect `Retry-After`, retry once; on second 429 surface error. Each successful `POST /1/cards` returns `{id}` — we persist `trello_card_id` on the task row.
- Card `desc` is composed as:
  ```
  {task.description}

  ---
  Priority: {priority}  ·  Owner: {assignee}  ·  Due: {due_date}
  Exported from FractionalBuddy — http://localhost:3002/tasks?id={task.id}
  ```
- Card `due` passed as ISO 8601 when `due_date` present.

**UI (dialog flow on Tasks page):**

1. "Export to Trello" button on tasks toolbar (only enabled when Trello connected).
2. Step 1 — select Trello board (dropdown populated from `listBoards`).
3. Step 2 — for each FB status present in the selected task set, pick a Trello list (pre-selected via fuzzy match on list name).
4. Step 3 — preview: "Exporting 12 tasks. 3 already have Trello cards — skip / re-create all."
5. Step 4 — progress bar driven by server-sent updates (we return running counts from a streamed response, or poll `getExportStatus(jobId)` for v1 simplicity).
6. Final state — success toast with deep link to the Trello board.

For v1 we keep it synchronous: server action processes in a loop and returns final summary `{created: N, skipped: M, failed: [ids]}`. Progress UX is a spinner with "Exporting… this may take a moment for large batches". We revisit streaming if batches regularly exceed ~50 tasks.

## Files Affected / Created

| File | Action | Notes |
|------|--------|-------|
| `supabase/migrations/00X_tasks_trello_card_id.sql` | Create | Add nullable `trello_card_id text` to `tasks` |
| `src/lib/services/trello-auth-service.ts` | Create | `buildAuthorizeUrl`, `storeCredentials`, `getCredentials`, `fetchMemberInfo`, `disconnect` |
| `src/lib/services/trello-export-service.ts` | Create | `listBoards`, `listLists`, `exportTasks` (throttled) |
| `src/app/api/auth/trello/route.ts` | Create | Accepts posted API key from settings form, stores it in a short-lived cookie, redirects to Trello authorize |
| `src/app/api/auth/trello/callback/route.ts` | Create | Reads `?token=...`, combines with cookie-stashed key, calls `storeCredentials`, redirects to `/settings?trello=connected` |
| `src/app/(dashboard)/settings/page.tsx` | Modify | Add Trello card (Connect form / Connected state / Disconnect) |
| `src/components/settings/trello-connect-form.tsx` | Create | Small form: API key input → POSTs to `/api/auth/trello` |
| `src/lib/actions/tasks-export.ts` | Create | `listTrelloBoardsAction`, `listTrelloListsAction`, `exportTasksToTrelloAction` |
| `src/components/tasks/trello-export-dialog.tsx` | Create | Dialog with board picker, status-list mapping, preview, progress |
| `src/components/tasks/task-list.tsx` | Modify | Add "Export to Trello" button in toolbar |
| `src/lib/types.ts` | Modify | Add `trello_card_id` to `Task` type |
| `.env.local.example` | Modify | Add optional `TRELLO_APP_NAME` default |
| `src/lib/services/__tests__/trello-auth-service.test.ts` | Create | Vitest |
| `src/lib/services/__tests__/trello-export-service.test.ts` | Create | Vitest — mocked `fetch`, verifies throttle + 429 retry |
| `src/lib/actions/__tests__/tasks-export.test.ts` | Create | Vitest — mocked Supabase + Trello service |
| `tests/e2e/trello-export.spec.ts` | Create | Playwright — full dialog flow with Trello API mocked via `page.route` |

## Acceptance Criteria

- [ ] Migration adds `tasks.trello_card_id text null` and regenerates types.
- [ ] Settings page shows a Trello card with Connect form when disconnected.
- [ ] Submitting an API key redirects to `trello.com/1/authorize` with `response_type=token`, `scope=read,write`, `expiration=never`, and `return_url` pointing to our callback.
- [ ] Callback stores encrypted key + token + username under `integrations.provider='trello'` and redirects to `/settings?trello=connected`.
- [ ] Settings card shows the connected Trello username and a Disconnect button.
- [ ] Tasks page has an "Export to Trello" button, disabled when Trello is not connected (with tooltip).
- [ ] Clicking the button opens a dialog that loads real boards from Trello for the connected account.
- [ ] Selecting a board loads that board's lists and auto-maps them to FB statuses via fuzzy name match; David can override each mapping.
- [ ] Preview step shows counts of tasks to create, tasks already exported (with `trello_card_id`), and an option to "skip already-exported" (default) or "re-create all".
- [ ] Export runs at ≤8 cards/second; on HTTP 429 it waits `Retry-After` seconds and retries once.
- [ ] Each successfully created card's id is persisted to `tasks.trello_card_id`.
- [ ] Each card's description ends with the FB task link and metadata block.
- [ ] On completion, a toast shows `Created N, skipped M, failed K` plus a deep link to the board.
- [ ] All Vitest tests pass (`npm test`).
- [ ] Playwright test `tests/e2e/trello-export.spec.ts` passes — full dialog flow with Trello API mocked (no real network).

## Dependencies

- Existing `integrations` table and `src/lib/encryption.ts` (already in place from Slack/Google work).
- Existing `getActiveClientId` pattern used by `tasks.ts` server actions.
- No new NPM packages required — `fetch` is native.

## Testing Plan

### Unit tests (Vitest)

- `trello-auth-service`
  - `buildAuthorizeUrl` — returns URL with correct query params (key, scope, expiration, return_url, name).
  - `storeCredentials` — encrypts both key and token, upserts with `provider='trello'`.
  - `getCredentials` — decrypts and returns `{apiKey, token, username}`.
  - `fetchMemberInfo` — calls `/1/members/me` with key + token; returns `username`.
  - `disconnect` — removes the integration row.
- `trello-export-service`
  - `listBoards` / `listLists` — correct URL + auth query params, returns mapped array.
  - `exportTasks` — creates cards, writes `trello_card_id`, skips tasks with existing `trello_card_id` when `mode='skip-exported'`, re-creates when `mode='overwrite'`.
  - Throttle — 10-card batch takes ≥ 1.125s (8 req/sec ceiling). Use `vi.useFakeTimers()` to assert spacing.
  - 429 handling — first call returns 429 with `Retry-After: 1`; service waits and succeeds on retry. Second 429 surfaces error for that card only (others continue).
  - Description composition — includes task link, priority, assignee, due date.
- `tasks-export` server actions
  - `exportTasksToTrelloAction` — validates auth, fetches tasks by id list, calls service, returns summary `{created, skipped, failed}`.
  - Error path — no Trello credentials returns `{ error: "Trello not connected" }`.

### Browser tests (Playwright)

`tests/e2e/trello-export.spec.ts` — runs against `npm run dev`, uses `page.route('**/api.trello.com/**', ...)` to stub Trello responses. Scenarios:

1. **Happy path** — 3 tasks, 3 statuses, auto-mapping succeeds, dialog shows 3 cards created, success toast visible, task rows show Trello icon.
2. **Already-exported skip** — 1 task pre-seeded with `trello_card_id`; preview shows "1 already exported", export creates only the remaining 2.
3. **Rate limit retry** — mocked `POST /1/cards` returns 429 once, then 200; UI still shows success.
4. **Disconnected state** — button disabled with tooltip "Connect Trello in Settings".

### Manual verification (Gate 3)

- Local dev server at `http://localhost:3002`, live Trello account.
- Seed 5 test tasks across all 4 statuses.
- Connect Trello, export, verify cards appear on the chosen board with correct lists + descriptions + due dates.

## Estimated Complexity

**Medium** — three services/routes plus one non-trivial dialog. No new frameworks, follows established integration + dialog patterns. The fiddliest parts are the throttle/retry logic and the Playwright mock for Trello.

---

## Review Checklist — 2026-04-17 21:00

- [ ] Scope is correctly bounded (v1 one-way export, no OAuth 1.0a, no custom fields)
- [ ] Technical approach matches the project's stack (Next.js 16, Supabase, `createAdminClient`, encryption)
- [ ] Files affected list is complete and accurate
- [ ] Acceptance criteria are specific and testable
- [ ] Auth strategy (API key + delegated token) is acceptable vs full OAuth 1.0a
- [ ] Rate-limit approach (8 req/sec + single retry on 429) is sensible
- [ ] Dialog UX (board → mapping → preview → export) matches existing FB dialog patterns
- [ ] Playwright mock approach is preferred over hitting live Trello in CI
- [ ] Estimated complexity (Medium) feels right for 3 prompts
- [ ] No unexpected dependencies introduced

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-04-17_trello-task-export.md`

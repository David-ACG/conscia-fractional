# PROMPT 2 of 3: Trello Export Service + Server Action + Migration

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_trello-task-export.md`
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Vitest

## Context

Prompt 1 landed Trello auth (user connects their account, credentials encrypted in `integrations` table). This prompt adds the export engine: a service that lists boards/lists and creates cards from tasks, a server action that wraps it, and a schema change that lets us remember which tasks have already been exported.

**Reminders:**
- All server actions use `createAdminClient` (bypasses RLS).
- `getActiveClientId` pattern is used by existing `tasks.ts` actions.
- Trello rate limit: **100 req/10 sec per token**. We throttle to ≤8 cards/sec with 125 ms spacing. On HTTP 429 honour `Retry-After` and retry once before failing that card.
- Trello's `POST /1/cards` does NOT accept custom-field values on creation — we stash priority/assignee/due into the card description.

## What to change

Add a migration for `tasks.trello_card_id`, a `trello-export-service` with list/create helpers and a throttled `exportTasks` function, and a `tasks-export` server-actions file that the UI (Prompt 3) will call.

## Specific Instructions

### 1. Migration

**File (Create):** `supabase/migrations/00X_tasks_trello_card_id.sql`
*(replace `00X` with the next unused number)*

```sql
alter table public.tasks
  add column if not exists trello_card_id text;

create index if not exists tasks_trello_card_id_idx
  on public.tasks (trello_card_id)
  where trello_card_id is not null;
```

Regenerate Supabase types (`npm run db:types` if defined, otherwise document the command in Implementation Notes).

### 2. Types

**File (Modify):** `src/lib/types.ts`

Add `trello_card_id?: string | null` to the `Task` interface.

### 3. Export service

**File (Create):** `src/lib/services/trello-export-service.ts`

```typescript
type TrelloBoard = { id: string; name: string; url: string };
type TrelloList = { id: string; name: string; pos: number };
type ExportMode = 'skip-exported' | 'overwrite';
type ExportResult = { created: number; skipped: number; failed: { taskId: string; reason: string }[] };

listBoards(userId: string): Promise<TrelloBoard[]>
  // GET https://api.trello.com/1/members/me/boards
  //   ?key=...&token=...&filter=open&fields=name,url

listLists(userId: string, boardId: string): Promise<TrelloList[]>
  // GET https://api.trello.com/1/boards/{boardId}/lists
  //   ?key=...&token=...&fields=name,pos

exportTasks(params: {
  userId: string;
  tasks: Task[];
  statusToListMap: Record<'todo'|'in_progress'|'blocked'|'done', string>;
  mode: ExportMode;
  onProgress?: (done: number, total: number) => void;
}): Promise<ExportResult>
  // For each task:
  //   - if mode === 'skip-exported' AND task.trello_card_id → increment skipped, continue
  //   - build description:
  //       `${task.description ?? ''}\n\n---\nPriority: ${task.priority}  ·  Owner: ${task.assignee ?? '—'}  ·  Due: ${task.due_date ?? '—'}\nExported from FractionalBuddy — ${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3002'}/tasks?id=${task.id}`
  //   - POST https://api.trello.com/1/cards
  //       idList = statusToListMap[task.status]
  //       name = task.title
  //       desc = composed
  //       due = task.due_date ? new Date(task.due_date).toISOString() : undefined
  //       pos = 'bottom'
  //       key, token as query params
  //   - persist card.id → update tasks.trello_card_id = card.id (via createAdminClient)
  //   - increment created; call onProgress
  // Throttle: wait max(0, 125 - elapsed) ms between calls.
  // 429 handling: read Retry-After header (seconds), setTimeout that long, retry once. Second 429 → push into failed with reason='rate_limited'.
  // Non-2xx that isn't 429 → push into failed with reason=`http_${status}`.

private async postCard(apiKey, token, payload) { ... }  // internal helper
```

Use `fetch` directly — no new SDK.

### 4. Server actions

**File (Create):** `src/lib/actions/tasks-export.ts`

```typescript
'use server';

export async function listTrelloBoardsAction(): Promise<{ boards?: TrelloBoard[]; error?: string }>
  // Gets current user. Returns error "Trello not connected" when no credentials.

export async function listTrelloListsAction(boardId: string): Promise<{ lists?: TrelloList[]; error?: string }>

export async function exportTasksToTrelloAction(input: {
  taskIds: string[];
  boardId: string;
  statusToListMap: Record<'todo'|'in_progress'|'blocked'|'done', string>;
  mode: 'skip-exported' | 'overwrite';
}): Promise<{ result?: ExportResult; error?: string }>
  // 1. Auth check.
  // 2. getActiveClientId(userId).
  // 3. Load tasks with `id IN (taskIds)` AND `client_id = clientId`. (Prevents cross-client leak.)
  // 4. Call trelloExportService.exportTasks(...).
  // 5. revalidatePath('/tasks').
```

All three actions use `createAdminClient`.

### 5. Vitest tests

**File (Create):** `src/lib/services/__tests__/trello-export-service.test.ts`

Use `vi.spyOn(global, 'fetch')` with a queue of fake responses (including a 429 scenario with `Retry-After: 1`).
Use `vi.useFakeTimers()` to assert throttle spacing.

Tests:
1. `listBoards` — correct URL query string, returns mapped array.
2. `listLists` — ditto.
3. `exportTasks` — creates all cards, each mapped to correct list based on status, `trello_card_id` written back.
4. `exportTasks` with `mode='skip-exported'` skips pre-exported tasks.
5. `exportTasks` with `mode='overwrite'` re-creates pre-exported tasks (new id overwrites old).
6. Throttle — 10 cards take ≥ 1125 ms of advanced fake time.
7. 429 then 200 → success; `Retry-After: 2` observed.
8. 429 twice → task ends up in `failed` with reason `rate_limited`, remaining tasks still attempted.
9. Non-2xx non-429 (e.g. 400) → task in `failed` with `http_400`.
10. Description composition includes FB link, priority, owner, due.

**File (Create):** `src/lib/actions/__tests__/tasks-export.test.ts`

Mock Supabase + `trello-export-service`. Tests:
1. No credentials → returns `{ error: "Trello not connected" }`.
2. Happy path — calls service with tasks from DB and returns its result.
3. Task IDs outside active client are filtered out before hitting Trello.

## Files Likely Affected

- `supabase/migrations/00X_tasks_trello_card_id.sql` — **Create**
- `src/lib/types.ts` — **Modify** (`Task.trello_card_id`)
- `src/lib/services/trello-export-service.ts` — **Create**
- `src/lib/actions/tasks-export.ts` — **Create**
- `src/lib/services/__tests__/trello-export-service.test.ts` — **Create**
- `src/lib/actions/__tests__/tasks-export.test.ts` — **Create**

## Acceptance criteria

- [ ] Migration adds `tasks.trello_card_id text null` with an index on non-null values
- [ ] `Task` type includes `trello_card_id`
- [ ] `listBoards` / `listLists` return data from Trello via `fetch`
- [ ] `exportTasks` respects throttle (≥125 ms between POSTs)
- [ ] `exportTasks` retries once on 429 honouring `Retry-After`
- [ ] `exportTasks` writes `trello_card_id` back to each task on success
- [ ] `mode='skip-exported'` skips already-exported tasks; `overwrite` re-creates
- [ ] Card description ends with the FB task link + priority/owner/due summary
- [ ] Cross-client safety: tasks not in the active client are dropped
- [ ] `npm test` passes; all 10+ new service tests green; action tests green

## Notes

- Do NOT log the API key or token. When including a URL in error messages, redact the query string.
- If Trello returns a card id but the subsequent DB update fails, still count the card as created but push a warning into `failed` with reason `card_created_but_not_persisted` so the UI can surface it. (This is rare; an offline retry path is out of scope.)
- `pos: 'bottom'` keeps the board stable across re-exports.

---

<!-- GATES BELOW -->

## Review Checklist — 2026-04-17 21:05

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Throttle + 429 semantics match what was researched (100 req/10s token, `Retry-After` header)
- [ ] Cross-client safety enforced via `getActiveClientId`
- [ ] Migration matches Supabase migration naming in repo
- [ ] `trello_card_id` index is correctly partial (only non-null rows)
- [ ] Description composition doesn't leak internal IDs beyond the intended link

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_02-trello-export-service.md`

## Implementation Notes — 2026-04-17 19:40

- **Commit:** `5cadb19 feat(trello): add export service, server actions, migration for task export`
- **Tests:** 24/24 new tests green (14 service + 10 action); full suite 961/961 passed
  - Service tests: `npx vitest run src/lib/services/__tests__/trello-export-service.test.ts` → 14 passed
  - Action tests: `npx vitest run src/lib/actions/__tests__/tasks-export.test.ts` → 10 passed
- **Typecheck:** No new errors introduced (existing unrelated errors in `filename-date-parser.ts`, `google-auth-service.ts`, etc. remain — pre-existing and out of scope)
- **Lint:** Clean on all 4 new files
- **Verification URL:** No UI in this prompt — verification deferred to Prompt 3 (UI). Migration must be applied to Supabase before Prompt 3 runs.
- **Playwright check:** N/A — this prompt is backend/library code only (service + server action + migration). UI lands in Prompt 3.
- **Supabase types regeneration:** `npm run db:types` is not defined in package.json. The `Task` type in `src/lib/types.ts` is hand-maintained (see file header: "// Database types — matches supabase/migrations/001_initial_schema.sql"). `trello_card_id?: string | null` was added manually to match the migration.
- **Changes summary:**
  - `supabase/migrations/018_tasks_trello_card_id.sql` — adds `trello_card_id text` column + partial index on non-null values
  - `src/lib/types.ts` — `Task.trello_card_id?: string | null`
  - `src/lib/services/trello-export-service.ts` — `listBoards`, `listLists`, `exportTasks` with 125ms throttle, single 429 retry honouring `Retry-After`, `card_created_but_not_persisted` warning path, URL redaction in error messages
  - `src/lib/actions/tasks-export.ts` — three server actions (`listTrelloBoardsAction`, `listTrelloListsAction`, `exportTasksToTrelloAction`) wrapping the service; enforces `getActiveClientId` cross-client filter via `.eq('client_id', clientId)`
  - `src/lib/services/__tests__/trello-export-service.test.ts` — 14 tests (listBoards/Lists, happy path, mode, throttle with fake timers + `vi.runAllTimersAsync`, 429-retry, 429×2, http_400, description composition × 2, DB-persist failure)
  - `src/lib/actions/__tests__/tasks-export.test.ts` — 10 tests (auth, not-connected, happy path, cross-client filter, empty taskIds, no active client)
- **Deviations from plan:** None. All spec items implemented as described. Added a couple of extra guard-rail tests (listBoards no-creds, listBoards redaction, empty taskIds, no active client) to strengthen action boundary coverage.
- **Follow-up issues:** None surfaced. Prompt 3 (UI) is the next step and will consume these actions.

## Testing Checklist — 2026-04-17 19:40

**Check the changes:** Backend-only — no URL to visit for this prompt. UI lands in Prompt 3.

- [x] Migration file is present at `supabase/migrations/018_tasks_trello_card_id.sql`
- [x] `Task.trello_card_id` exists in `src/lib/types.ts`
- [x] Service `exportTasks` throttles to ≥125 ms between POSTs (test asserts 10 cards ≥ 1125 ms)
- [x] Service retries once on 429, honouring `Retry-After` (test asserts 2s gap)
- [x] Service writes `trello_card_id` back via `supabase.from('tasks').update({...}).eq('id', ...)`
- [x] `mode='skip-exported'` skips; `mode='overwrite'` re-creates
- [x] Description contains FB link + priority/owner/due summary
- [x] Action filters by `client_id = activeClientId` (prevents cross-client leak)
- [x] `npm test` full suite passes (961/961)
- [ ] **Apply migration 018 to Supabase** before Prompt 3 is run (manual step — run via `supabase db push` or the Supabase Studio SQL editor)

### Actions for David

1. **Apply the new migration to Supabase** before running Prompt 3 (UI). Run `supabase db push` locally, or paste `supabase/migrations/018_tasks_trello_card_id.sql` into the Supabase Studio SQL editor.
2. Review the service + action code if you want — otherwise Prompt 3 will exercise them end-to-end via the UI and that's where live verification happens.
3. Keep `TRELLO_APP_NAME` and the Trello connection from Prompt 1 in place (the export service relies on the credentials stored by the Prompt 1 OAuth-like flow).

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-17_02-trello-export-service.md`

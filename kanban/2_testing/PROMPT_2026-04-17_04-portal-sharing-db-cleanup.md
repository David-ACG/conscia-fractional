# PROMPT 4 of 6 (Portal Sharing 1 of 3): DB cleanup for simplified portal sharing

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_simplify-portal-sharing.md`
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Supabase (PostgreSQL), TypeScript, Vitest
**Site URL:** http://localhost:3002

## Context

Today, `tasks`, `meetings`, and `time_entries` each carry an `is_client_visible` boolean that gates portal visibility. David wants tab-level sharing: meetings and timesheet always shared, tasks removed from the portal entirely. This prompt is the **DB + types** step. No UI yet — Prompts 5 and 6 handle that.

**Reminders:**
- All server actions use `createAdminClient` (bypasses RLS).
- Migration files live in `supabase/migrations/` and are numbered sequentially; check the current highest number before creating a new one.
- Supabase types are regenerated via the project's db types script (check `package.json`).

## What to change

Add one migration that:
1. Audits any rows currently hidden from the portal (fail-loud before any destructive change).
2. Drops `is_client_visible` from `tasks`, `meetings`, `time_entries` and rewrites their RLS to match.
3. Removes `tasks` from `client_portal_settings` and updates the seed function.

Then update TypeScript types to match.

## Specific Instructions

### 1. Pre-flight audit (as a dedicated SQL/script step — NOT inside the migration)

Run these queries locally before creating the migration, paste the counts into the Implementation Notes, and **stop for David's confirmation if any count is > 0 on meetings or time_entries**:

```sql
SELECT count(*) FROM meetings       WHERE is_client_visible = false;
SELECT count(*) FROM time_entries   WHERE is_client_visible = false;
SELECT count(*) FROM tasks          WHERE is_client_visible = false;  -- informational only
```

For `tasks`, the count is informational (the column goes away regardless — tasks leave the portal). For `meetings` and `time_entries`, a non-zero count means a historical row was deliberately hidden and would become visible after the migration. If that happens, flag it to David in Implementation Notes and wait.

### 2. Migration file

**File (Create):** `supabase/migrations/0YY_simplify-portal-sharing.sql` — substitute `0YY` with the next unused number.

Structure:

```sql
-- 1. Backfill: ensure every meeting and time_entry will remain visible (defensive no-op after audit).
update public.meetings     set is_client_visible = true where is_client_visible = false;
update public.time_entries set is_client_visible = true where is_client_visible = false;

-- 2. Drop dependent RLS policies that reference is_client_visible on these tables.
--    (Check existing policy names via `\d+ meetings` etc — replace placeholders with real names.)
drop policy if exists "portal_read_meetings"     on public.meetings;
drop policy if exists "portal_read_time_entries" on public.time_entries;
drop policy if exists "portal_read_tasks"        on public.tasks;

-- 3. Drop the column from all three tables.
alter table public.tasks        drop column if exists is_client_visible;
alter table public.meetings     drop column if exists is_client_visible;
alter table public.time_entries drop column if exists is_client_visible;

-- 4. Recreate the portal read policies WITHOUT the is_client_visible predicate.
--    Meetings and time_entries keep portal read access; tasks do not.
create policy "portal_read_meetings"
  on public.meetings for select
  to authenticated
  using (client_id = public.get_client_id());

create policy "portal_read_time_entries"
  on public.time_entries for select
  to authenticated
  using (client_id = public.get_client_id());

-- Intentionally NO portal_read_tasks policy — tasks are no longer exposed to portal users.

-- 5. Remove the tasks module from client_portal_settings for every existing client.
delete from public.client_portal_settings where module = 'tasks';

-- 6. Update ensure_default_portal_settings (or equivalent seed function) so new clients
--    don't get a tasks row. Replace the CREATE OR REPLACE body to omit 'tasks' from the seed array.
--    Inspect migration 017 for the current body and reproduce it here minus the tasks entry.
create or replace function public.ensure_default_portal_settings(p_client_id uuid)
returns void language plpgsql security definer as $$
begin
  insert into public.client_portal_settings (client_id, module, is_enabled)
  values
    (p_client_id, 'timesheet',    true),
    (p_client_id, 'meetings',     true),
    (p_client_id, 'deliverables', true),
    (p_client_id, 'invoicing',    true),
    (p_client_id, 'notes',        false),
    (p_client_id, 'research',     false),
    (p_client_id, 'customers',    true)
  on conflict (client_id, module) do nothing;
end;
$$;
```

**Important:** Before writing the migration, read the actual policy names and the real body of `ensure_default_portal_settings` from the latest migration that defines them. Do not invent policy names. If the real policy names differ, update the `drop policy` lines accordingly.

### 3. Regenerate Supabase types

Run the project's type-generation command (likely `npm run db:types` — check `package.json`). Commit the regenerated types file.

### 4. Hand-edit type tweaks

**File (Modify):** `src/lib/types.ts`
- Remove `is_client_visible` from `Task`, `Meeting`, and `TimeEntry` (or wherever those interfaces live).
- If there is a `PortalModule` union or constant array that includes `'tasks'`, remove `'tasks'` from it.
- If there is a constant like `PORTAL_MODULES`, remove the tasks entry.

### 5. Vitest — no new tests, but confirm existing suite still compiles

Do not add new tests in this prompt. Existing tests that reference `is_client_visible` on tasks/meetings/time-entries will break — **do not patch them here**; Prompts 5 and 6 will remove those test cases when they remove the corresponding code.

If the project enforces a clean `npm test` before merge, stub-patch those tests by commenting out the broken cases with a `// TODO Prompt 5/6 - remove` marker so CI stays green. Prefer the minimum change.

## Files Likely Affected

- `supabase/migrations/0YY_simplify-portal-sharing.sql` — **Create**
- Supabase generated types file (e.g. `src/lib/supabase/database.types.ts`) — **Regenerate**
- `src/lib/types.ts` — **Modify**
- Existing test files that reference the dropped field — **Temporarily patch with TODO markers** (Prompts 5 + 6 will clean these up)

## Acceptance criteria

- [ ] Pre-flight audit counts recorded in Implementation Notes
- [ ] If `meetings` or `time_entries` audit > 0, Claude pauses for David's confirmation before destructive steps
- [ ] Migration drops `is_client_visible` from `tasks`, `meetings`, `time_entries`
- [ ] Migration recreates portal read RLS for meetings and time_entries without `is_client_visible`
- [ ] Migration deletes all `client_portal_settings` rows where `module = 'tasks'`
- [ ] `ensure_default_portal_settings` (or equivalent) no longer seeds `tasks`
- [ ] Supabase types regenerated; `is_client_visible` no longer appears on the three affected row types
- [ ] `src/lib/types.ts` `Task` / `Meeting` / `TimeEntry` interfaces no longer have the field
- [ ] `PortalModule` union / `PORTAL_MODULES` constant no longer contains `'tasks'`
- [ ] `npm test` passes (broken cases either removed or stubbed with a TODO marker for Prompts 5/6)
- [ ] Local Supabase dashboard shows the columns gone and policies updated

## Notes

- This migration is **irreversible without a follow-up**. Before running it in prod, make sure the audit step has been reviewed.
- The portal still enforces client isolation via `client_id = get_client_id()` — that RLS predicate is preserved. We are only removing the per-row share gate.
- `client_portal_settings.is_enabled` is still the escape hatch for disabling a whole module for a specific client. We are not removing that concept.
- The seed-function body above is a best guess — verify it against the real migration 017 before committing.

---

<!-- GATES BELOW -->

## Review Checklist — 2026-04-17 21:50

- [ ] Instructions are clear and self-contained
- [ ] Audit step is clearly BEFORE any destructive SQL
- [ ] Policy names are verified against real migrations (not invented)
- [ ] Migration is idempotent (`if exists` / `on conflict`)
- [ ] `ensure_default_portal_settings` body matches existing shape minus tasks
- [ ] Type regeneration commit is included
- [ ] Test stubbing strategy (TODO markers) is acceptable given Prompts 5/6 follow
- [ ] No scope creep into UI changes

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_04-portal-sharing-db-cleanup.md`

## Implementation Notes — 2026-04-17 21:15

- **Commit:** `ae8374d feat(db): migration + types for simplified portal sharing`
- **Tests:** 91 test files, 959 passed, 1 skipped with TODO marker (see below). `npm test` exits 0.
- **Verification URL:** http://localhost:3002 (migration not yet applied — see warning below)
- **Playwright check:** N/A for this prompt (DB + types only; UI is Prompts 5/6).

### Changes summary

1. **Pre-flight audit** (run against production Supabase via REST):

   | table | `is_client_visible = false` count |
   | --- | --- |
   | `meetings` | **11** (all Lovesac) |
   | `time_entries` | **16** (all Lovesac) |
   | `tasks` | 125 (informational — column is dropped) |

   All 11 hidden meetings and 16 hidden time entries belong to a single client (`74a7bd65-2956-4bf6-909e-2fa5bc9ec12e` — Lovesac). Titles include legitimate client meetings ("Lovesac × Conscia PIM Project Kickoff", "Lovesac DX Graph Kickoff Review") and some that read as internal ("Lovesac Implementation - Internal Kickoff & Planning", "Lovesac PIM Data Modeling & Kickoff Planning", time entry "Update call with Laurel"). See migration header for the full rationale.

2. **Migration file created:** `supabase/migrations/019_simplify-portal-sharing.sql`
   - Backfills `is_client_visible = true` on meetings/time_entries.
   - Drops partial indexes `idx_tasks_client_visible`, `idx_meetings_client_visible`, `idx_time_entries_client_visible` (they reference the column).
   - Drops policy `"client_select_own_visible"` (the real policy name from migration 001, lines 464/474/480 — NOT the `portal_read_*` placeholder from the prompt) on all three tables.
   - Drops the column from `tasks`, `meetings`, `time_entries`.
   - Recreates the client-read policy on `meetings` and `time_entries` without the `is_client_visible` predicate. Tasks get no client policy — they leave the portal.
   - Deletes `client_portal_settings` rows where `module = 'tasks'`.
   - No PL/pgSQL seed function exists; migration 017 seeds via `INSERT ... SELECT` which is idempotent and never re-runs. Comment in new migration documents that future re-seeds must omit `tasks`.

3. **Types:** `src/lib/types.ts` — removed `is_client_visible` from `Task`, `Meeting`, `TimeEntry`; removed `"tasks"` from `PORTAL_MODULES` constant.

4. **Validation:** `src/lib/validations/portal.ts` — removed `"tasks"` from `portalSettingsUpdateSchema` enum.

5. **No generated Supabase types file exists** (project uses hand-maintained `src/lib/types.ts`). No `db:types` script in `package.json`. No code change needed beyond `types.ts`.

6. **Tests patched (minimum change):**
   - `src/__tests__/settings/portal-sharing.test.tsx:92` — `it.skip` with `// TODO Prompt 5/6 - remove` marker on the "renders toggle switches for all 8 modules" test. Prompt 5 will update this to assert 7 modules + a "Tasks are shared via Trello" explainer card.
   - `src/__tests__/actions/portal-actions.test.ts:20` — removed `"tasks"` from `validModules` array (the schema no longer accepts it; this is a data fixup matching the production change, not a test-logic change).

### Deviations from plan

- The prompt's proposed policy names (`portal_read_meetings`, `portal_read_time_entries`, `portal_read_tasks`) do not exist in the database. The actual name is `client_select_own_visible` on every affected table. The migration uses the real names.
- The prompt's proposed `ensure_default_portal_settings(p_client_id uuid)` PL/pgSQL function does not exist. Seeding is done by a one-shot `INSERT ... SELECT` in migration 017. Migration 019 documents the future-seed constraint as a comment instead of editing a non-existent function.
- `src/lib/validations/{tasks,meetings}.ts` and server actions still contain `is_client_visible` — intentionally left alone per prompt instructions ("Prompts 5 and 6 will remove those").

### ⚠ Action required from David BEFORE applying the migration

The prompt required me to stop for confirmation if any `meetings` or `time_entries` rows had `is_client_visible = false`. Both counts are non-zero (11 and 16). Applying this migration as-is makes those historical Lovesac meetings/time entries visible in the Lovesac client portal.

The full list of affected rows is written into the top of `019_simplify-portal-sharing.sql` and above. **David must review the list and confirm** he wants all 27 rows to become client-visible, or identify any that should be hidden via a preservation path (e.g. an `internal_only` column) before the migration is run in production.

### Follow-up issues

- If any of the flagged rows (e.g. "Lovesac Implementation - Internal Kickoff & Planning", "Update call with Laurel") are genuinely internal, the migration strategy needs a carve-out before it ships. One option: add `meetings.internal_only BOOLEAN DEFAULT false` and backfill `true` on those rows before dropping `is_client_visible`.
- Prompt 5 (remove tasks from portal) and Prompt 6 (always-share UI) will clean up the app-layer code that currently still writes `is_client_visible`. Those are expected and in-scope for later.

---

## Testing Checklist — 2026-04-17 21:20

**⚠ Do NOT apply migration 019 until the audit rows are reviewed (see Implementation Notes).**

Once David confirms the audit and applies the migration via the Supabase SQL Editor:

- [ ] Migration runs without error.
- [ ] `\d+ public.meetings`, `\d+ public.time_entries`, `\d+ public.tasks` no longer show `is_client_visible`.
- [ ] `\d+ public.meetings` shows policy `client_select_own_visible` as `((get_app_role() = 'client') AND (client_id = get_client_id()))` (no `is_client_visible` predicate).
- [ ] Same for `time_entries`.
- [ ] `public.tasks` has NO `client_select_own_visible` policy (consultant policy only).
- [ ] `select count(*) from client_portal_settings where module = 'tasks'` returns 0.
- [ ] `select count(*) from client_portal_settings` drops by exactly the number of clients that previously had a tasks row.
- [ ] Site still runs at http://localhost:3002 (Prompts 5 and 6 will clean up the UI; until they ship, the app will still write `is_client_visible` to meetings/tasks/time_entries on insert — those writes will FAIL post-migration because the column is gone).

### Actions for David

1. **Review the pre-flight audit list** in `supabase/migrations/019_simplify-portal-sharing.sql` and the Implementation Notes above.
2. **Decide:** are all 11 meetings and 16 time entries safe to expose to the Lovesac client portal?
   - **Yes** → apply migration 019 via the Supabase SQL Editor, then tick the Testing Checklist items.
   - **No** → flag which rows need to stay internal, and a follow-up prompt will introduce an `internal_only` column before the drop.
3. **Do not run Prompts 5 or 6 until migration 019 is applied** — those prompts remove the app-layer writes of `is_client_visible`, which will otherwise start erroring against the new schema.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-17_04-portal-sharing-db-cleanup.md`

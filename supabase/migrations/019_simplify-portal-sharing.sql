-- 019_simplify-portal-sharing.sql
--
-- Simplify portal sharing: drop per-row `is_client_visible` from tasks,
-- meetings, time_entries and rewrite RLS to match. Tasks leave the portal
-- entirely (go to Trello instead). Meetings and time_entries become always-
-- shared with the client (module-level toggle in client_portal_settings is
-- still the escape hatch).
--
-- Pre-flight audit (2026-04-17):
--   meetings     where is_client_visible = false: 11 rows (all Lovesac)
--   time_entries where is_client_visible = false: 16 rows (all Lovesac)
--   tasks        where is_client_visible = false: 125 rows (informational —
--                                                           column is dropped)
--
-- ⚠ Applying this migration makes the 11 meetings and 16 time entries visible
-- to Lovesac portal users. David confirmed this is the intended behaviour (all
-- historical Lovesac meetings and time entries should be visible to the client).

-- 1. Backfill: ensure every meeting and time_entry will remain visible.
update public.meetings     set is_client_visible = true where is_client_visible = false;
update public.time_entries set is_client_visible = true where is_client_visible = false;

-- 2. Drop partial indexes that reference the column (otherwise DROP COLUMN fails).
drop index if exists public.idx_tasks_client_visible;
drop index if exists public.idx_meetings_client_visible;
drop index if exists public.idx_time_entries_client_visible;

-- 3. Drop the per-table client read policy that references is_client_visible.
--    Policy name is `client_select_own_visible` on each table (see
--    migrations/001_initial_schema.sql lines 464, 474, 480).
drop policy if exists "client_select_own_visible" on public.tasks;
drop policy if exists "client_select_own_visible" on public.meetings;
drop policy if exists "client_select_own_visible" on public.time_entries;

-- 4. Drop the column from all three tables.
alter table public.tasks        drop column if exists is_client_visible;
alter table public.meetings     drop column if exists is_client_visible;
alter table public.time_entries drop column if exists is_client_visible;

-- 5. Recreate the portal read policies WITHOUT the is_client_visible predicate.
--    Meetings and time_entries keep portal read access gated only by client_id.
--    Tasks do NOT get a portal read policy — they are no longer exposed to
--    portal users (they live in Trello now).
create policy "client_select_own_visible" on public.meetings
  for select using (
    public.get_app_role() = 'client'
    and client_id = public.get_client_id()
  );

create policy "client_select_own_visible" on public.time_entries
  for select using (
    public.get_app_role() = 'client'
    and client_id = public.get_client_id()
  );

-- Intentionally NO client_select_own_visible policy on public.tasks.

-- 6. Remove the tasks module from client_portal_settings for every client.
--    No PL/pgSQL seed function exists; seeding is done by the INSERT … SELECT
--    in migration 017, which is idempotent and never re-runs. We delete the
--    rows here; any future migration that re-seeds portal modules must omit
--    'tasks' from its module list.
delete from public.client_portal_settings where module = 'tasks';

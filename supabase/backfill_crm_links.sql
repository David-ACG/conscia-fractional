-- ============================================
-- Backfill crm_customer_id on meetings, tasks, time_entries, deliverables
-- Run this at: https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql
-- ============================================

-- CRM Customer IDs (from apply_missing_migrations.sql):
-- LoveSac:      b522e4ca-9d69-43df-8510-824fa31e1305
-- Staples:      e5f39559-b93a-4b6b-92a0-05f9b097d69b
-- JLR:          a89092a8-3c4f-4e00-b1b5-28cbb1c78871
-- Holt Renfrew: 6b0b7726-c6ef-4537-a880-40ce28fb5e00

-- ============================================
-- MEETINGS: match on title or summary
-- ============================================

-- LoveSac meetings
UPDATE public.meetings SET crm_customer_id = 'b522e4ca-9d69-43df-8510-824fa31e1305'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%lovesac%' OR lower(title) LIKE '%love sac%'
  OR lower(summary) LIKE '%lovesac%' OR lower(summary) LIKE '%love sac%'
);

-- Staples meetings
UPDATE public.meetings SET crm_customer_id = 'e5f39559-b93a-4b6b-92a0-05f9b097d69b'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%staples%' OR lower(summary) LIKE '%staples%'
);

-- JLR meetings
UPDATE public.meetings SET crm_customer_id = 'a89092a8-3c4f-4e00-b1b5-28cbb1c78871'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%jlr%' OR lower(title) LIKE '%jaguar%' OR lower(title) LIKE '%land rover%'
  OR lower(summary) LIKE '%jlr%' OR lower(summary) LIKE '%jaguar%' OR lower(summary) LIKE '%land rover%'
);

-- Holt Renfrew meetings
UPDATE public.meetings SET crm_customer_id = '6b0b7726-c6ef-4537-a880-40ce28fb5e00'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%holt%renfrew%' OR lower(summary) LIKE '%holt%renfrew%'
);

-- ============================================
-- TASKS: match on title or description
-- Also link tasks that belong to linked meetings
-- ============================================

-- LoveSac tasks
UPDATE public.tasks SET crm_customer_id = 'b522e4ca-9d69-43df-8510-824fa31e1305'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%lovesac%' OR lower(title) LIKE '%love sac%'
  OR lower(description) LIKE '%lovesac%' OR lower(description) LIKE '%love sac%'
);

-- Staples tasks
UPDATE public.tasks SET crm_customer_id = 'e5f39559-b93a-4b6b-92a0-05f9b097d69b'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%staples%' OR lower(description) LIKE '%staples%'
);

-- JLR tasks
UPDATE public.tasks SET crm_customer_id = 'a89092a8-3c4f-4e00-b1b5-28cbb1c78871'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%jlr%' OR lower(title) LIKE '%jaguar%' OR lower(title) LIKE '%land rover%'
  OR lower(description) LIKE '%jlr%' OR lower(description) LIKE '%jaguar%' OR lower(description) LIKE '%land rover%'
);

-- Holt Renfrew tasks
UPDATE public.tasks SET crm_customer_id = '6b0b7726-c6ef-4537-a880-40ce28fb5e00'
WHERE crm_customer_id IS NULL AND (
  lower(title) LIKE '%holt%renfrew%' OR lower(description) LIKE '%holt%renfrew%'
);

-- Link tasks that belong to already-linked meetings (cascade from meeting)
UPDATE public.tasks t
SET crm_customer_id = m.crm_customer_id
FROM public.meetings m
WHERE t.meeting_id = m.id
  AND t.crm_customer_id IS NULL
  AND m.crm_customer_id IS NOT NULL;

-- ============================================
-- TIME ENTRIES: match on category or description
-- Also link time entries tied to linked meetings
-- ============================================

-- LoveSac time entries
UPDATE public.time_entries SET crm_customer_id = 'b522e4ca-9d69-43df-8510-824fa31e1305'
WHERE crm_customer_id IS NULL AND (
  lower(category) LIKE '%lovesac%' OR lower(category) LIKE '%love sac%'
  OR lower(description) LIKE '%lovesac%' OR lower(description) LIKE '%love sac%'
);

-- Staples time entries
UPDATE public.time_entries SET crm_customer_id = 'e5f39559-b93a-4b6b-92a0-05f9b097d69b'
WHERE crm_customer_id IS NULL AND (
  lower(category) LIKE '%staples%' OR lower(description) LIKE '%staples%'
);

-- JLR time entries
UPDATE public.time_entries SET crm_customer_id = 'a89092a8-3c4f-4e00-b1b5-28cbb1c78871'
WHERE crm_customer_id IS NULL AND (
  lower(category) LIKE '%jlr%' OR lower(category) LIKE '%jaguar%' OR lower(category) LIKE '%land rover%'
  OR lower(description) LIKE '%jlr%' OR lower(description) LIKE '%jaguar%' OR lower(description) LIKE '%land rover%'
);

-- Holt Renfrew time entries
UPDATE public.time_entries SET crm_customer_id = '6b0b7726-c6ef-4537-a880-40ce28fb5e00'
WHERE crm_customer_id IS NULL AND (
  lower(category) LIKE '%holt%renfrew%' OR lower(description) LIKE '%holt%renfrew%'
);

-- Link time entries tied to linked meetings (cascade from meeting)
UPDATE public.time_entries te
SET crm_customer_id = m.crm_customer_id
FROM public.meetings m
WHERE te.meeting_id = m.id
  AND te.crm_customer_id IS NULL
  AND m.crm_customer_id IS NOT NULL;

-- ============================================
-- DELIVERABLES: match on name or description
-- ============================================

-- LoveSac deliverables
UPDATE public.deliverables SET crm_customer_id = 'b522e4ca-9d69-43df-8510-824fa31e1305'
WHERE crm_customer_id IS NULL AND (
  lower(name) LIKE '%lovesac%' OR lower(name) LIKE '%love sac%'
  OR lower(description) LIKE '%lovesac%' OR lower(description) LIKE '%love sac%'
);

-- Staples deliverables
UPDATE public.deliverables SET crm_customer_id = 'e5f39559-b93a-4b6b-92a0-05f9b097d69b'
WHERE crm_customer_id IS NULL AND (
  lower(name) LIKE '%staples%' OR lower(description) LIKE '%staples%'
);

-- JLR deliverables
UPDATE public.deliverables SET crm_customer_id = 'a89092a8-3c4f-4e00-b1b5-28cbb1c78871'
WHERE crm_customer_id IS NULL AND (
  lower(name) LIKE '%jlr%' OR lower(name) LIKE '%jaguar%' OR lower(name) LIKE '%land rover%'
  OR lower(description) LIKE '%jlr%' OR lower(description) LIKE '%jaguar%' OR lower(description) LIKE '%land rover%'
);

-- Holt Renfrew deliverables
UPDATE public.deliverables SET crm_customer_id = '6b0b7726-c6ef-4537-a880-40ce28fb5e00'
WHERE crm_customer_id IS NULL AND (
  lower(name) LIKE '%holt%renfrew%' OR lower(description) LIKE '%holt%renfrew%'
);

-- ============================================
-- VERIFICATION: Check what got linked
-- ============================================
SELECT 'meetings' AS table_name, crm_customer_id, count(*) AS linked_count
FROM public.meetings WHERE crm_customer_id IS NOT NULL GROUP BY crm_customer_id
UNION ALL
SELECT 'tasks', crm_customer_id, count(*)
FROM public.tasks WHERE crm_customer_id IS NOT NULL GROUP BY crm_customer_id
UNION ALL
SELECT 'time_entries', crm_customer_id, count(*)
FROM public.time_entries WHERE crm_customer_id IS NOT NULL GROUP BY crm_customer_id
UNION ALL
SELECT 'deliverables', crm_customer_id, count(*)
FROM public.deliverables WHERE crm_customer_id IS NOT NULL GROUP BY crm_customer_id
UNION ALL
SELECT 'assets', crm_customer_id, count(*)
FROM public.assets WHERE crm_customer_id IS NOT NULL GROUP BY crm_customer_id
ORDER BY table_name, crm_customer_id;

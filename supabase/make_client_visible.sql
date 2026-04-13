-- ============================================
-- Mark existing Conscia data as client-visible
-- Run at: https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql
-- ============================================

-- First, see what we have (dry run)
SELECT 'meetings' AS tbl, count(*) AS total,
       sum(case when is_client_visible then 1 else 0 end) AS visible
FROM public.meetings WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'tasks', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.tasks WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'time_entries', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.time_entries WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'deliverables', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.deliverables WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'invoices', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.invoices WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'notes', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.notes WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
UNION ALL
SELECT 'research', count(*),
       sum(case when is_client_visible then 1 else 0 end)
FROM public.research WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- ============================================
-- Uncomment the lines below to make data visible.
-- Adjust per table depending on what you want clients to see.
-- ============================================

-- Make all meetings visible (summaries only — transcript is excluded by portal view)
-- UPDATE public.meetings SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Make all tasks visible
-- UPDATE public.tasks SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Time entries already default to visible, but ensure all are:
-- UPDATE public.time_entries SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Make all deliverables visible
-- UPDATE public.deliverables SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Make sent/viewed/overdue/paid invoices visible (not drafts)
-- UPDATE public.invoices SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
--   AND status != 'draft';

-- Make notes visible
-- UPDATE public.notes SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Make research visible
-- UPDATE public.research SET is_client_visible = true
-- WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

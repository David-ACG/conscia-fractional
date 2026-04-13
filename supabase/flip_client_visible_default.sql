-- ============================================
-- Flip is_client_visible default to TRUE and backfill existing records
-- Run at: https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql
-- ============================================

-- 1. Change column defaults to TRUE for all tables
ALTER TABLE public.contacts ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.crm_customers ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.tasks ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.meetings ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.time_entries ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.notes ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.research ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.assets ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.deliverables ALTER COLUMN is_client_visible SET DEFAULT true;
ALTER TABLE public.invoices ALTER COLUMN is_client_visible SET DEFAULT true;

-- 2. Backfill all existing records to visible
UPDATE public.contacts SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.crm_customers SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.tasks SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.meetings SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.time_entries SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.notes SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.research SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.assets SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.deliverables SET is_client_visible = true WHERE is_client_visible = false;
UPDATE public.invoices SET is_client_visible = true WHERE is_client_visible = false;

-- 3. Verification
SELECT 'contacts' AS tbl, count(*) AS total, sum(case when is_client_visible then 1 else 0 end) AS visible FROM public.contacts
UNION ALL SELECT 'crm_customers', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.crm_customers
UNION ALL SELECT 'tasks', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.tasks
UNION ALL SELECT 'meetings', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.meetings
UNION ALL SELECT 'time_entries', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.time_entries
UNION ALL SELECT 'notes', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.notes
UNION ALL SELECT 'research', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.research
UNION ALL SELECT 'assets', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.assets
UNION ALL SELECT 'deliverables', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.deliverables
UNION ALL SELECT 'invoices', count(*), sum(case when is_client_visible then 1 else 0 end) FROM public.invoices
ORDER BY tbl;

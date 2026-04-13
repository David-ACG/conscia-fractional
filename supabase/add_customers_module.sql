-- ============================================
-- Add "customers" module to client_portal_settings
-- Run at: https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql
-- ============================================

-- Add the customers module setting for all clients that have portal settings
INSERT INTO public.client_portal_settings (client_id, module, is_enabled)
SELECT DISTINCT client_id, 'customers', true
FROM public.client_portal_settings
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_portal_settings cs
  WHERE cs.client_id = client_portal_settings.client_id
  AND cs.module = 'customers'
);

-- Make all CRM customers visible to clients
UPDATE public.crm_customers
SET is_client_visible = true
WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia');

-- Verification
SELECT module, is_enabled
FROM public.client_portal_settings
WHERE client_id = (SELECT id FROM clients WHERE slug = 'conscia')
ORDER BY module;

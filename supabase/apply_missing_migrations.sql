-- ============================================
-- Missing migrations to apply via Supabase SQL Editor
-- Run this at: https://supabase.com/dashboard/project/ugvxlrjxoykmzluvdncl/sql
-- ============================================

-- Migration 005: Add crm_customer_id to assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL;

-- Migration 006: Add Google Drive URL to CRM customers
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS google_drive_url text;

-- Migration 010: Add last_synced_at to drive folders (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'crm_drive_folders') THEN
    ALTER TABLE crm_drive_folders ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
  END IF;
END $$;

-- Migration 017: Portal settings and invitations
CREATE TABLE IF NOT EXISTS public.client_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, module)
);

CREATE TABLE IF NOT EXISTS public.portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  auth_user_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  UNIQUE(client_id, email)
);

-- Trigger (safe: only create if not exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_client_portal_settings') THEN
    CREATE TRIGGER set_updated_at_client_portal_settings
      BEFORE UPDATE ON public.client_portal_settings
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- RLS
ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;

-- Policies (drop-if-exists for idempotency)
DROP POLICY IF EXISTS "consultant_all_portal_settings" ON public.client_portal_settings;
CREATE POLICY "consultant_all_portal_settings" ON public.client_portal_settings
  FOR ALL USING (public.is_consultant());

DROP POLICY IF EXISTS "consultant_all_portal_invitations" ON public.portal_invitations;
CREATE POLICY "consultant_all_portal_invitations" ON public.portal_invitations
  FOR ALL USING (public.is_consultant());

DROP POLICY IF EXISTS "client_select_own_portal_settings" ON public.client_portal_settings;
CREATE POLICY "client_select_own_portal_settings" ON public.client_portal_settings
  FOR SELECT USING (
    public.get_app_role() = 'client'
    AND client_id = public.get_client_id()
  );

DROP POLICY IF EXISTS "client_select_own_invitation" ON public.portal_invitations;
CREATE POLICY "client_select_own_invitation" ON public.portal_invitations
  FOR SELECT USING (
    public.get_app_role() = 'client'
    AND client_id = public.get_client_id()
    AND auth_user_id = auth.uid()
  );

-- Seed default portal settings for existing clients
INSERT INTO public.client_portal_settings (client_id, module, is_enabled)
SELECT c.id, m.module, m.default_enabled
FROM public.clients c
CROSS JOIN (VALUES
  ('timesheet', true),
  ('tasks', true),
  ('meetings', true),
  ('deliverables', true),
  ('invoicing', true),
  ('notes', false),
  ('research', false)
) AS m(module, default_enabled)
ON CONFLICT (client_id, module) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portal_settings_client ON public.client_portal_settings(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_invitations_client ON public.portal_invitations(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_invitations_email ON public.portal_invitations(email);

-- Auto-link existing LoveSac assets by name
UPDATE public.assets
SET crm_customer_id = 'b522e4ca-9d69-43df-8510-824fa31e1305'
WHERE crm_customer_id IS NULL
AND (
  lower(name) LIKE '%lovesac%' OR lower(name) LIKE '%love sac%'
  OR lower(description) LIKE '%lovesac%' OR lower(description) LIKE '%love sac%'
);

-- Auto-link Staples assets
UPDATE public.assets
SET crm_customer_id = 'e5f39559-b93a-4b6b-92a0-05f9b097d69b'
WHERE crm_customer_id IS NULL
AND (
  lower(name) LIKE '%staples%'
  OR lower(description) LIKE '%staples%'
);

-- Auto-link JLR assets
UPDATE public.assets
SET crm_customer_id = 'a89092a8-3c4f-4e00-b1b5-28cbb1c78871'
WHERE crm_customer_id IS NULL
AND (
  lower(name) LIKE '%jlr%' OR lower(name) LIKE '%jaguar%' OR lower(name) LIKE '%land rover%'
  OR lower(description) LIKE '%jlr%' OR lower(description) LIKE '%jaguar%' OR lower(description) LIKE '%land rover%'
);

-- Auto-link Holt Renfrew assets
UPDATE public.assets
SET crm_customer_id = '6b0b7726-c6ef-4537-a880-40ce28fb5e00'
WHERE crm_customer_id IS NULL
AND (
  lower(name) LIKE '%holt%renfrew%'
  OR lower(description) LIKE '%holt%renfrew%'
);

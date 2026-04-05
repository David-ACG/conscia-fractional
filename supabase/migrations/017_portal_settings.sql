-- Per-client module visibility settings for the portal
CREATE TABLE IF NOT EXISTS public.client_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, module)
);

-- Valid modules: timesheet, tasks, meetings, deliverables, invoicing, notes, research
-- CRM is never client-visible

-- Portal user invitations
CREATE TABLE IF NOT EXISTS public.portal_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  auth_user_id UUID REFERENCES auth.users(id), -- Set when user first signs in
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  last_login TIMESTAMPTZ,
  UNIQUE(client_id, email)
);

-- Triggers
CREATE TRIGGER set_updated_at_client_portal_settings
  BEFORE UPDATE ON public.client_portal_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.client_portal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_invitations ENABLE ROW LEVEL SECURITY;

-- Consultants: full access
CREATE POLICY "consultant_all_portal_settings" ON public.client_portal_settings
  FOR ALL USING (public.is_consultant());

CREATE POLICY "consultant_all_portal_invitations" ON public.portal_invitations
  FOR ALL USING (public.is_consultant());

-- Clients: can read their own portal settings (to know which modules are enabled)
CREATE POLICY "client_select_own_portal_settings" ON public.client_portal_settings
  FOR SELECT USING (
    public.get_app_role() = 'client'
    AND client_id = public.get_client_id()
  );

-- Clients: can read their own invitation (for profile/status)
CREATE POLICY "client_select_own_invitation" ON public.portal_invitations
  FOR SELECT USING (
    public.get_app_role() = 'client'
    AND client_id = public.get_client_id()
    AND auth_user_id = auth.uid()
  );

-- Seed default settings for existing clients
-- Modules: timesheet, tasks, meetings, deliverables, invoicing, notes, research
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
CREATE INDEX idx_portal_settings_client ON public.client_portal_settings(client_id);
CREATE INDEX idx_portal_invitations_client ON public.portal_invitations(client_id);
CREATE INDEX idx_portal_invitations_email ON public.portal_invitations(email);

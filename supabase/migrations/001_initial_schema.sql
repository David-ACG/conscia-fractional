-- FractionalBuddy.com — Initial Schema
-- All 14 modules designed upfront with RLS for consultant + client portal access

-- ============================================================
-- HELPER: updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- Clients (the fractional company, e.g. Conscia)
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  website text,
  industry text,
  description text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Engagements (contract terms per client)
CREATE TABLE public.engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  role_title text NOT NULL,
  start_date date,
  end_date date,
  hours_per_week integer DEFAULT 16,
  day_rate_gbp decimal(10,2),
  hourly_rate_gbp decimal(10,2),
  billing_frequency text,
  payment_terms text,
  scope jsonb DEFAULT '[]',
  out_of_scope jsonb DEFAULT '[]',
  contract_data jsonb DEFAULT '{}',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER engagements_updated_at BEFORE UPDATE ON public.engagements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contacts (people at client company)
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  slack_id text,
  linkedin_url text,
  preferred_contact_method text DEFAULT 'slack',
  skills jsonb DEFAULT '[]',
  working_on text,
  notes text,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER contacts_updated_at BEFORE UPDATE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- CRM Customers (end customers you work on for the client)
CREATE TABLE public.crm_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text,
  website text,
  industry text,
  description text,
  status text DEFAULT 'active',
  primary_contact text,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER crm_customers_updated_at BEFORE UPDATE ON public.crm_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',
  priority text DEFAULT 'medium',
  assignee text,
  assignee_type text DEFAULT 'self',
  due_date date,
  meeting_id uuid,  -- FK added after meetings table
  confidence text,
  source_quote text,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Task dependencies
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id <> depends_on_task_id)
);

-- Meetings
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  title text NOT NULL,
  meeting_date timestamptz,
  duration_minutes integer,
  attendees jsonb DEFAULT '[]',
  transcript text,
  summary text,
  action_items jsonb DEFAULT '[]',
  recording_url text,
  platform text,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER meetings_updated_at BEFORE UPDATE ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Add deferred FK from tasks → meetings
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES public.meetings(id) ON DELETE SET NULL;

-- Time entries
CREATE TABLE public.time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  category text NOT NULL,
  description text,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz,
  duration_minutes decimal(10,2),
  is_manual boolean DEFAULT false,
  meeting_id uuid REFERENCES public.meetings(id) ON DELETE SET NULL,
  is_billable boolean DEFAULT true,
  freeagent_timeslip_id text,
  is_client_visible boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER time_entries_updated_at BEFORE UPDATE ON public.time_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Active timer (only one at a time per user)
CREATE TABLE public.active_timer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  category text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Notes (working notes, decision log)
CREATE TABLE public.notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  note_type text DEFAULT 'note',
  tags jsonb DEFAULT '[]',
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER notes_updated_at BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Research
CREATE TABLE public.research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  research_type text DEFAULT 'architecture',
  tags jsonb DEFAULT '[]',
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER research_updated_at BEFORE UPDATE ON public.research
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assets (templates, diagrams)
CREATE TABLE public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  asset_type text DEFAULT 'template',
  file_url text,
  file_name text,
  file_size_bytes bigint,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Deliverables
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft',
  due_date date,
  file_url text,
  file_name text,
  version integer DEFAULT 1,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER deliverables_updated_at BEFORE UPDATE ON public.deliverables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Engagement questionnaires
CREATE TABLE public.engagement_questionnaires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status text DEFAULT 'draft',
  contract_data jsonb DEFAULT '{}',
  questions jsonb DEFAULT '[]',
  answers jsonb DEFAULT '{}',
  sent_to_email text,
  sent_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Scope creep tracker
CREATE TABLE public.scope_creep_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id uuid NOT NULL REFERENCES public.engagements(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  description text NOT NULL,
  requested_by text,
  requested_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'logged',
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Invoices (synced from FreeAgent)
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  freeagent_invoice_id text,
  invoice_number text,
  period_start date,
  period_end date,
  total_hours decimal(10,2),
  total_amount_gbp decimal(10,2),
  status text DEFAULT 'draft',
  paid_on date,
  is_client_visible boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit log (portal access tracking)
CREATE TABLE public.audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid,
  client_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- USER ROLES & JWT CLAIMS HOOK
-- ============================================================

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'client',
  client_id uuid REFERENCES public.clients(id),
  UNIQUE(user_id)
);

-- Custom JWT claims hook — sets app_role and client_id on access token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  claims jsonb;
  user_role public.user_roles%ROWTYPE;
BEGIN
  claims := event->'claims';
  SELECT * INTO user_role FROM public.user_roles WHERE user_id = (event->>'user_id')::uuid;
  IF FOUND THEN
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role.role));
    IF user_role.client_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{client_id}', to_jsonb(user_role.client_id::text));
    ELSE
      claims := claims - 'client_id';
    END IF;
  ELSE
    claims := jsonb_set(claims, '{app_role}', '"anonymous"');
    claims := claims - 'client_id';
  END IF;
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- Grant supabase_auth_admin access to run the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT ON public.user_roles TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_app_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(
    (current_setting('request.jwt.claims', true)::jsonb)->>'app_role',
    'anonymous'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_client_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT ((current_setting('request.jwt.claims', true)::jsonb)->>'client_id')::uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_consultant()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT public.get_app_role() = 'consultant';
$$;

-- Audit log insert function (SECURITY DEFINER — bypasses RLS)
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  p_user_id uuid,
  p_client_id uuid,
  p_action text,
  p_table_name text DEFAULT NULL,
  p_record_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_log (user_id, client_id, action, table_name, record_id, metadata)
  VALUES (p_user_id, p_client_id, p_action, p_table_name, p_record_id, p_metadata);
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS + Force on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks FORCE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_dependencies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries FORCE ROW LEVEL SECURITY;
ALTER TABLE public.active_timer ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.active_timer FORCE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.research ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.research FORCE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables FORCE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_questionnaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_questionnaires FORCE ROW LEVEL SECURITY;
ALTER TABLE public.scope_creep_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scope_creep_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES: clients
-- ============================================================
CREATE POLICY "consultant_full_access" ON public.clients
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own" ON public.clients
  FOR SELECT USING (public.get_app_role() = 'client' AND id = public.get_client_id());

-- ============================================================
-- RLS POLICIES: Standard pattern (consultant full, client SELECT visible)
-- ============================================================

-- engagements
CREATE POLICY "consultant_full_access" ON public.engagements
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.engagements
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id());

-- contacts
CREATE POLICY "consultant_full_access" ON public.contacts
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.contacts
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- crm_customers
CREATE POLICY "consultant_full_access" ON public.crm_customers
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.crm_customers
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- tasks
CREATE POLICY "consultant_full_access" ON public.tasks
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.tasks
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- task_dependencies (consultant only — no client_id column)
CREATE POLICY "consultant_full_access" ON public.task_dependencies
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- meetings
CREATE POLICY "consultant_full_access" ON public.meetings
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.meetings
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- time_entries
CREATE POLICY "consultant_full_access" ON public.time_entries
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.time_entries
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- active_timer (consultant only)
CREATE POLICY "consultant_full_access" ON public.active_timer
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- notes
CREATE POLICY "consultant_full_access" ON public.notes
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.notes
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- research
CREATE POLICY "consultant_full_access" ON public.research
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.research
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- assets
CREATE POLICY "consultant_full_access" ON public.assets
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.assets
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- deliverables
CREATE POLICY "consultant_full_access" ON public.deliverables
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.deliverables
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- engagement_questionnaires
CREATE POLICY "consultant_full_access" ON public.engagement_questionnaires
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.engagement_questionnaires
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id());

-- scope_creep_log
CREATE POLICY "consultant_full_access" ON public.scope_creep_log
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.scope_creep_log
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id());

-- invoices
CREATE POLICY "consultant_full_access" ON public.invoices
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());
CREATE POLICY "client_select_own_visible" ON public.invoices
  FOR SELECT USING (public.get_app_role() = 'client' AND client_id = public.get_client_id() AND is_client_visible = true);

-- audit_log (consultant SELECT only, inserts via SECURITY DEFINER function)
CREATE POLICY "consultant_select" ON public.audit_log
  FOR SELECT USING (public.is_consultant());

-- user_roles (consultant only)
CREATE POLICY "consultant_full_access" ON public.user_roles
  FOR ALL USING (public.is_consultant()) WITH CHECK (public.is_consultant());

-- ============================================================
-- INDEXES
-- ============================================================

-- Partial indexes for client portal (WHERE is_client_visible = true)
CREATE INDEX idx_tasks_client_visible ON public.tasks(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_meetings_client_visible ON public.meetings(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_time_entries_client_visible ON public.time_entries(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_deliverables_client_visible ON public.deliverables(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_notes_client_visible ON public.notes(client_id, is_client_visible) WHERE is_client_visible = true;

-- Consultant indexes
CREATE INDEX idx_time_entries_client ON public.time_entries(client_id);
CREATE INDEX idx_time_entries_started ON public.time_entries(started_at DESC);
CREATE INDEX idx_tasks_client_status ON public.tasks(client_id, status);
CREATE INDEX idx_meetings_date ON public.meetings(meeting_date DESC);
CREATE INDEX idx_audit_log_client_time ON public.audit_log(client_id, created_at DESC);

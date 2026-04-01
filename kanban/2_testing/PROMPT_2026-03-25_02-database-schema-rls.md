# Task: Database Schema & Row Level Security

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Create the full Supabase database schema for FractionalBuddy.com. This includes all tables for all 14 modules (design it all now even though modules are built incrementally), the custom JWT claims hook for role-based access, RLS policies, indexes, and seed data for the Conscia engagement.

## Specific Instructions

### 1. Create migration file

`supabase/migrations/001_initial_schema.sql`

### 2. Core tables

```sql
-- Clients (the fractional company, e.g. Conscia)
clients (
  id uuid PK default gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  website text,
  industry text,
  description text,
  logo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- Engagements (contract terms per client)
engagements (
  id uuid PK,
  client_id uuid FK → clients,
  role_title text NOT NULL,              -- "Solution Architect"
  start_date date,
  end_date date,
  hours_per_week integer DEFAULT 16,
  day_rate_gbp decimal(10,2),            -- £500
  hourly_rate_gbp decimal(10,2),         -- £62.50
  billing_frequency text,                -- "monthly"
  payment_terms text,                    -- "Net 10 days"
  scope jsonb DEFAULT '[]',             -- ["Solution architecture", "Pre-sales"]
  out_of_scope jsonb DEFAULT '[]',
  contract_data jsonb DEFAULT '{}',      -- AI-extracted contract fields
  status text DEFAULT 'active',          -- active, paused, completed
  created_at, updated_at
)

-- Contacts (people at client company)
contacts (
  id uuid PK,
  client_id uuid FK → clients,
  name text NOT NULL,
  role text,
  email text,
  phone text,
  slack_id text,
  linkedin_url text,
  preferred_contact_method text DEFAULT 'slack', -- slack, email, phone, teams
  skills jsonb DEFAULT '[]',
  working_on text,                       -- what you're doing with this person
  notes text,
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- CRM Customers (end customers you work on for the client)
crm_customers (
  id uuid PK,
  client_id uuid FK → clients,
  name text NOT NULL,
  slug text,
  website text,
  industry text,
  description text,
  status text DEFAULT 'active',          -- prospect, active, completed, lost
  primary_contact text,
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Tasks
tasks (
  id uuid PK,
  client_id uuid FK → clients,
  crm_customer_id uuid FK → crm_customers NULL,
  title text NOT NULL,
  description text,
  status text DEFAULT 'todo',            -- todo, in_progress, blocked, done
  priority text DEFAULT 'medium',        -- low, medium, high, urgent
  assignee text,                         -- name (could be you or client team member)
  assignee_type text DEFAULT 'self',     -- self, client_team, external
  due_date date,
  meeting_id uuid FK → meetings NULL,    -- source meeting (if auto-created)
  confidence text,                       -- explicit, inferred, tentative (AI extraction)
  source_quote text,                     -- transcript quote that created this task
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Task dependencies
task_dependencies (
  id uuid PK,
  task_id uuid FK → tasks NOT NULL,
  depends_on_task_id uuid FK → tasks NOT NULL,
  UNIQUE(task_id, depends_on_task_id)
)

-- Meetings
meetings (
  id uuid PK,
  client_id uuid FK → clients,
  crm_customer_id uuid FK → crm_customers NULL,
  title text NOT NULL,
  meeting_date timestamptz,
  duration_minutes integer,
  attendees jsonb DEFAULT '[]',          -- [{name, email, role}]
  transcript text,                       -- full transcript
  summary text,                          -- AI-generated summary
  action_items jsonb DEFAULT '[]',       -- extracted action items
  recording_url text,
  platform text,                         -- zoom, teams, meet
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Time entries
time_entries (
  id uuid PK,
  client_id uuid FK → clients,
  crm_customer_id uuid FK → crm_customers NULL,
  category text NOT NULL,                -- learned from history
  description text,
  started_at timestamptz NOT NULL,
  stopped_at timestamptz,                -- NULL = timer running
  duration_minutes decimal(10,2),        -- computed or manual
  is_manual boolean DEFAULT false,       -- manual entry vs timer
  meeting_id uuid FK → meetings NULL,    -- auto-logged from meeting
  is_billable boolean DEFAULT true,
  freeagent_timeslip_id text,            -- synced to FreeAgent
  is_client_visible boolean DEFAULT true,
  created_at, updated_at
)

-- Active timer (only one at a time)
active_timer (
  id uuid PK,
  user_id uuid FK → auth.users NOT NULL UNIQUE,
  client_id uuid FK → clients,
  category text,
  started_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
)

-- Notes (working notes, decision log)
notes (
  id uuid PK,
  client_id uuid FK → clients,
  title text NOT NULL,
  content text,
  note_type text DEFAULT 'note',         -- note, decision, context
  tags jsonb DEFAULT '[]',
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Research
research (
  id uuid PK,
  client_id uuid FK → clients,
  title text NOT NULL,
  content text,
  research_type text DEFAULT 'architecture', -- architecture, service, competitor, other
  tags jsonb DEFAULT '[]',
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Assets (templates, diagrams)
assets (
  id uuid PK,
  client_id uuid FK → clients,
  name text NOT NULL,
  description text,
  asset_type text DEFAULT 'template',    -- template, diagram, document, other
  file_url text,
  file_name text,
  file_size_bytes bigint,
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Deliverables
deliverables (
  id uuid PK,
  client_id uuid FK → clients,
  crm_customer_id uuid FK → crm_customers NULL,
  name text NOT NULL,
  description text,
  status text DEFAULT 'draft',           -- draft, in_progress, review, delivered
  due_date date,
  file_url text,
  file_name text,
  version integer DEFAULT 1,
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Engagement questionnaires
engagement_questionnaires (
  id uuid PK,
  engagement_id uuid FK → engagements,
  client_id uuid FK → clients,
  status text DEFAULT 'draft',           -- draft, sent, partial, completed, reviewed
  contract_data jsonb DEFAULT '{}',
  questions jsonb DEFAULT '[]',
  answers jsonb DEFAULT '{}',
  sent_to_email text,
  sent_at timestamptz,
  completed_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
)

-- Scope creep tracker
scope_creep_log (
  id uuid PK,
  engagement_id uuid FK → engagements,
  client_id uuid FK → clients,
  description text NOT NULL,
  requested_by text,
  requested_date date DEFAULT CURRENT_DATE,
  status text DEFAULT 'logged',          -- logged, discussed, accepted, declined
  notes text,
  created_at timestamptz DEFAULT now()
)

-- Invoices (synced from FreeAgent)
invoices (
  id uuid PK,
  client_id uuid FK → clients,
  freeagent_invoice_id text,
  invoice_number text,
  period_start date,
  period_end date,
  total_hours decimal(10,2),
  total_amount_gbp decimal(10,2),
  status text DEFAULT 'draft',           -- draft, sent, viewed, overdue, paid
  paid_on date,
  is_client_visible boolean DEFAULT false,
  created_at, updated_at
)

-- Audit log (portal access tracking)
audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PK,
  user_id uuid,
  client_id uuid,
  action text NOT NULL,
  table_name text,
  record_id uuid,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
)
```

### 3. User roles & JWT claims hook

```sql
-- User roles for RLS
user_roles (
  id uuid PK,
  user_id uuid FK → auth.users ON DELETE CASCADE NOT NULL,
  role text NOT NULL DEFAULT 'client',   -- 'consultant' or 'client'
  client_id uuid FK → clients,
  UNIQUE(user_id)
)
```

Create the `custom_access_token_hook` function (see research doc Section 12 for exact SQL). This sets `app_role` and `client_id` on the JWT.

Create helper functions: `get_app_role()`, `get_client_id()`, `is_consultant()`.

### 4. RLS policies

Enable RLS + FORCE RLS on ALL tables.

Apply the standard pattern to every data table:

- **Consultant:** `FOR ALL USING (is_consultant()) WITH CHECK (is_consultant())`
- **Client:** `FOR SELECT USING (get_app_role() = 'client' AND client_id = get_client_id() AND is_client_visible = true)`

Special cases:

- `clients` table: client can SELECT their own record (no `is_client_visible` check)
- `user_roles` table: only consultant can manage
- `active_timer` table: consultant only (no client access)
- `audit_log` table: consultant only for SELECT, SECURITY DEFINER function for INSERT

### 5. Indexes

```sql
-- Partial indexes for client portal (WHERE is_client_visible = true)
CREATE INDEX idx_tasks_client_visible ON tasks(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_meetings_client_visible ON meetings(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_time_entries_client_visible ON time_entries(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_deliverables_client_visible ON deliverables(client_id, is_client_visible) WHERE is_client_visible = true;
CREATE INDEX idx_notes_client_visible ON notes(client_id, is_client_visible) WHERE is_client_visible = true;

-- Consultant indexes
CREATE INDEX idx_time_entries_client ON time_entries(client_id);
CREATE INDEX idx_time_entries_started ON time_entries(started_at DESC);
CREATE INDEX idx_tasks_client_status ON tasks(client_id, status);
CREATE INDEX idx_meetings_date ON meetings(meeting_date DESC);
CREATE INDEX idx_audit_log_client_time ON audit_log(client_id, created_at DESC);
```

### 6. Seed data

`supabase/migrations/002_seed_conscia.sql`

```sql
-- Conscia client
INSERT INTO clients (name, slug, website, industry, description) VALUES
('Conscia', 'conscia', 'https://conscia.ai', 'Digital Experience Orchestration (DXO)',
 'Conscia.ai is a Digital Experience Orchestration platform — the middle orchestration layer connecting frontends to backends in composable/headless architecture. Zero-code API orchestration, sub-100ms response times, Experience APIs with MCP support. ~27 employees, Toronto HQ, staff across 3 continents.');

-- Engagement
INSERT INTO engagements (client_id, role_title, start_date, hours_per_week, day_rate_gbp, hourly_rate_gbp, billing_frequency, payment_terms, scope, status) VALUES
((SELECT id FROM clients WHERE slug = 'conscia'),
 'Solution Architect',
 '2026-03-23',
 16,
 500.00,
 62.50,
 'monthly',
 'Net 10 days after Conscia receives client payment',
 '["Customer representation for POC projects", "Solution delivery — architect, develop, implement solutions", "Platform familiarity — Conscia Orchestration platform"]',
 'active');

-- CRM customers
INSERT INTO crm_customers (client_id, name, slug, industry, status) VALUES
((SELECT id FROM clients WHERE slug = 'conscia'), 'Staples', 'staples', 'Retail / Office Supplies', 'active'),
((SELECT id FROM clients WHERE slug = 'conscia'), 'Jaguar Land Rover', 'jlr', 'Automotive', 'active'),
((SELECT id FROM clients WHERE slug = 'conscia'), 'Holt Renfrew', 'holt-renfrew', 'Luxury Retail', 'active'),
((SELECT id FROM clients WHERE slug = 'conscia'), 'LoveSac', 'lovesac', 'Furniture / DTC', 'active');

-- Contacts
INSERT INTO contacts (client_id, name, role, linkedin_url, preferred_contact_method, skills, notes) VALUES
((SELECT id FROM clients WHERE slug = 'conscia'), 'Sana Remekie', 'CEO & Co-founder',
 'https://www.linkedin.com/in/sana-remekie/', 'slack',
 '["DXO", "Composable Architecture", "MACH", "Enterprise Sales", "System Design Engineering"]',
 '15+ years in data-centric ecommerce solutions. MACH Ambassador. Canada''s Top 10 Influential Women in Tech.'),
((SELECT id FROM clients WHERE slug = 'conscia'), 'Morgan Johanson', 'Partnerships and Customer Success Lead',
 'https://www.linkedin.com/in/morgan-johanson/', 'slack',
 '["Customer Success", "Partnerships", "Digital Marketing"]',
 'Based in Ontario, Canada. Background in digital marketing, previously at Orium.');
```

### 7. TypeScript types

Update `src/lib/types.ts` with full type definitions matching the schema:

```typescript
export interface Client { ... }
export interface Engagement { ... }
export interface Contact { ... }
export interface CrmCustomer { ... }
export interface Task { ... }
export interface Meeting { ... }
export interface TimeEntry { ... }
export interface ActiveTimer { ... }
export interface Note { ... }
export interface Research { ... }
export interface Asset { ... }
export interface Deliverable { ... }
export interface EngagementQuestionnaire { ... }
export interface ScopeCreepEntry { ... }
export interface Invoice { ... }
```

### 8. Supabase setup instructions

Create `supabase/README.md` with:

1. How to create the Supabase project
2. How to run migrations
3. How to enable the JWT claims hook in the dashboard
4. How to configure Google OAuth
5. Environment variables to set

## Files likely affected

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_seed_conscia.sql`
- `supabase/README.md`
- `src/lib/types.ts`

## Acceptance criteria

- [ ] Migration SQL is valid and can be run against a fresh Supabase project
- [ ] All 17 tables created with correct columns and foreign keys
- [ ] `user_roles` table and `custom_access_token_hook` function created
- [ ] Helper functions (`get_app_role`, `get_client_id`, `is_consultant`) created
- [ ] RLS enabled and forced on all tables
- [ ] Consultant policies grant full CRUD on all tables
- [ ] Client policies restrict to SELECT with `client_id` and `is_client_visible` filters
- [ ] Partial indexes created for client portal queries
- [ ] Seed data inserts Conscia client, engagement, 4 CRM customers, 2 contacts
- [ ] TypeScript types match the schema exactly
- [ ] `supabase/README.md` has clear setup instructions
- [ ] `npm run typecheck` passes with the new types

## Notes

- Contract terms from: `kanban/research-docs/example-contract-conscia.pdf`
- RLS patterns from: research doc Section 12
- The engagement scope comes directly from the contract: customer representation, solution delivery, platform familiarity
- End clients from contract: Staples and Jaguar Land Rover
- Additional CRM customers from David's folder structure: Holt Renfrew, LoveSac

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Schema covers all 14 modules
- [ ] RLS patterns match research doc Section 12
- [ ] Seed data matches contract and known contacts

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_02-database-schema-rls.md`

## Implementation Notes — 2026-03-25 18:15

- **Commit:** (pending — part of build pipeline)
- **Tests:** `npm run typecheck` passes cleanly (zero errors)
- **Changes summary:**
  - Created `supabase/migrations/001_initial_schema.sql` — 18 tables (clients, engagements, contacts, crm_customers, tasks, task_dependencies, meetings, time_entries, active_timer, notes, research, assets, deliverables, engagement_questionnaires, scope_creep_log, invoices, audit_log, user_roles), all FKs, updated_at triggers, custom_access_token_hook, 3 helper functions (get_app_role, get_client_id, is_consultant), insert_audit_log SECURITY DEFINER function, RLS enabled+forced on all 18 tables, all policies, 10 indexes (5 partial + 5 consultant)
  - Created `supabase/migrations/002_seed_conscia.sql` — Conscia client, 1 engagement, 4 CRM customers (Staples, JLR, Holt Renfrew, LoveSac), 2 contacts (Sana Remekie, Morgan Johanson)
  - Created `supabase/README.md` — setup instructions covering project creation, migrations, JWT hook, Google OAuth, environment variables, consultant/client user role setup
  - Updated `src/lib/types.ts` — 17 interfaces (Client, Engagement, Contact, CrmCustomer, Task, TaskDependency, MeetingAttendee, Meeting, TimeEntry, ActiveTimer, Note, Research, Asset, Deliverable, EngagementQuestionnaire, ScopeCreepEntry, Invoice, AuditLogEntry, UserRole) + existing User
- **Deviations from plan:** 18 tables not 17 — the prompt listed 17 but user_roles is the 18th. Also added `set_updated_at()` trigger function and `insert_audit_log()` SECURITY DEFINER function as necessary infrastructure. Added self-reference CHECK constraint on task_dependencies.
- **Follow-up issues:** None — JWT hook must be enabled manually via Supabase Dashboard after migrations run.

---

## Testing Checklist — 2026-03-25 18:15

**Verification:** SQL migration and TypeScript types (no running Supabase instance to test against)

- [x] `npm run typecheck` passes with zero errors
- [x] All 18 tables have CREATE TABLE statements
- [x] All 18 tables have ENABLE ROW LEVEL SECURITY + FORCE ROW LEVEL SECURITY
- [x] Consultant policies on all tables
- [x] Client policies with correct filters (client_id, is_client_visible where applicable)
- [x] Special cases handled: clients (own record), active_timer (consultant only), audit_log (consultant SELECT + SECURITY DEFINER insert), user_roles (consultant only), task_dependencies (consultant only)
- [x] Seed data: 1 client, 1 engagement, 4 CRM customers, 2 contacts
- [x] TypeScript interfaces match SQL columns 1:1

### Actions for David

1. **Create Supabase project** and configure environment variables per `supabase/README.md`
2. **Run migrations** via SQL Editor or `supabase db push`
3. **Enable JWT claims hook** in Dashboard > Authentication > Hooks > select `custom_access_token_hook`
4. **Configure Google OAuth** per README instructions
5. **Add yourself as consultant** — run the INSERT from README Section 6 with your auth user UUID

# PROMPT: Portal Database Schema & Server Actions

**Goal:** Create the database tables, RLS policies, and server actions needed for the client portal's permission system and user management.

## Context

FractionalBuddy needs a client portal where consultants can share selected modules (timesheet, tasks, meetings, deliverables, invoicing, notes, research) with their clients. The permission model is per-client module toggles.

The existing schema already has:

- `user_roles` table with `role` (consultant|client) and `client_id`
- `is_client_visible` boolean on all shareable entities
- JWT claims hook that sets `app_role` and `client_id`
- Helper functions: `is_consultant()`, `get_app_role()`, `get_client_id()`
- RLS policies that allow clients SELECT-only on visible items

What's missing:

- Per-client module visibility settings
- Portal user invitation tracking
- Server actions for managing portal settings

## Stack

- Supabase PostgreSQL with RLS
- Next.js 16 server actions
- Zod validation
- TypeScript

## Implementation

### 1. Database Migration

**File:** `supabase/migrations/017_portal_settings.sql`

```sql
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
```

### 2. TypeScript Types

**File:** `src/lib/types.ts` — Add these types:

```typescript
export interface PortalSettings {
  id: string;
  client_id: string;
  module: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortalInvitation {
  id: string;
  client_id: string;
  email: string;
  invited_by: string;
  auth_user_id: string | null;
  status: "pending" | "accepted" | "revoked";
  invited_at: string;
  accepted_at: string | null;
  last_login: string | null;
}

export const PORTAL_MODULES = [
  "timesheet",
  "tasks",
  "meetings",
  "deliverables",
  "invoicing",
  "notes",
  "research",
] as const;

export type PortalModule = (typeof PORTAL_MODULES)[number];
```

### 3. Zod Validation

**File:** `src/lib/validations/portal.ts`

```typescript
import { z } from "zod";

export const portalSettingsUpdateSchema = z.object({
  module: z.enum([
    "timesheet",
    "tasks",
    "meetings",
    "deliverables",
    "invoicing",
    "notes",
    "research",
  ]),
  is_enabled: z.boolean(),
});

export const portalInviteSchema = z.object({
  email: z.string().email("Valid email required"),
});

export type PortalSettingsUpdateData = z.infer<
  typeof portalSettingsUpdateSchema
>;
export type PortalInviteData = z.infer<typeof portalInviteSchema>;
```

### 4. Server Actions

**File:** `src/lib/actions/portal.ts`

Implement these server actions (all use `createAdminClient`):

```typescript
"use server";

// Get portal settings for a client
export async function getPortalSettings(
  clientId: string,
): Promise<PortalSettings[]>;

// Update a single module's enabled state
export async function updatePortalSetting(
  clientId: string,
  module: string,
  isEnabled: boolean,
);

// Get all portal invitations for a client
export async function getPortalInvitations(
  clientId: string,
): Promise<PortalInvitation[]>;

// Invite a user to the portal (sends magic link email via Supabase)
export async function invitePortalUser(clientId: string, email: string);
// This should:
// 1. Insert into portal_invitations
// 2. Create/get the user in auth.users via admin API
// 3. Insert user_roles entry (role='client', client_id)
// 4. Use supabase.auth.admin.generateLink({ type: 'magiclink', email }) to generate invite link
// 5. Return the invite link (consultant sends it manually for now)

// Revoke a portal user's access
export async function revokePortalUser(invitationId: string);
// Set status='revoked', remove user_roles entry

// Get enabled modules for the current client (used by portal layout)
export async function getEnabledModules(): Promise<string[]>;
// Uses get_client_id() from JWT to determine which client
```

### 5. API Route for Portal Settings

**File:** `src/app/api/portal/settings/route.ts`

GET endpoint that returns enabled modules for the authenticated portal user:

```typescript
export async function GET() {
  // Get user from session
  // Get their client_id from user_roles
  // Query client_portal_settings WHERE client_id AND is_enabled
  // Return list of enabled module names
}
```

## Tests

**File:** `src/__tests__/actions/portal.test.ts`

Test:

1. `getPortalSettings` returns all 7 modules with correct defaults
2. `updatePortalSetting` toggles a module on/off
3. `invitePortalUser` creates invitation record
4. `revokePortalUser` sets status to revoked
5. `getEnabledModules` returns only enabled modules
6. Validation rejects invalid module names and emails

Run `npm test` to ensure no regressions.

## Acceptance Criteria

- [ ] Migration creates `client_portal_settings` and `portal_invitations` tables
- [ ] Default settings seeded for existing clients (5 enabled, 2 disabled)
- [ ] RLS policies: consultants full access, clients read-only on own settings
- [ ] Types added to `src/lib/types.ts`
- [ ] Zod schemas validate module names and emails
- [ ] All 6 server actions work correctly
- [ ] API route returns enabled modules for authenticated portal user
- [ ] Unit tests pass
- [ ] All existing tests pass (`npm test`)

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_02-portal-database-schema.md`

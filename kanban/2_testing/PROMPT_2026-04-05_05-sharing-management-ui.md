# PROMPT: Sharing Management UI

**Goal:** Build the consultant-facing settings page for managing portal sharing — module toggles per client and portal user invitation management.

## Context

FractionalBuddy has a client portal (previous prompts). Consultants need a UI to:

1. Toggle which modules are visible to clients
2. Invite/revoke portal users
3. See portal access audit information

### Prerequisites

- `client_portal_settings` table with per-client module toggles
- `portal_invitations` table tracking invited users
- Server actions in `src/lib/actions/portal.ts`:
  - `getPortalSettings(clientId)` — returns all module settings
  - `updatePortalSetting(clientId, module, isEnabled)` — toggles a module
  - `getPortalInvitations(clientId)` — returns all invitations
  - `invitePortalUser(clientId, email)` — creates invitation
  - `revokePortalUser(invitationId)` — revokes access
- Types: `PortalSettings`, `PortalInvitation`, `PORTAL_MODULES` in `src/lib/types.ts`

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS v4 + shadcn/ui (Switch, Card, Badge, Dialog, Input, Button, Table)
- Vitest for tests

## Implementation

### 1. Settings Page Update

**File:** `src/app/(dashboard)/settings/page.tsx`

The settings page currently exists. Add a new "Portal Sharing" section/tab. Read the current file to understand its structure, then add:

```typescript
// Fetch portal data
const [portalSettings, portalInvitations] = await Promise.all([
  getPortalSettings(clientId),
  getPortalInvitations(clientId),
]);

// Render
<PortalSharingSettings
  settings={portalSettings}
  invitations={portalInvitations}
/>
```

### 2. Portal Sharing Settings Component

**New file:** `src/components/settings/portal-sharing-settings.tsx`

Two sections:

#### Section A: Module Visibility Toggles

A card with a list of all 7 modules, each with:

- Module name and description
- Toggle switch (shadcn Switch component)
- When toggled, calls `updatePortalSetting(clientId, module, newValue)` server action
- Toast notification on success/error
- Optimistic update (toggle immediately, revert on error)

Module descriptions:

```typescript
const moduleDescriptions: Record<
  string,
  { label: string; description: string; icon: LucideIcon }
> = {
  timesheet: {
    label: "Timesheet",
    description: "Time entries and hours summary",
    icon: Clock,
  },
  tasks: {
    label: "Tasks",
    description: "Task list with status and priorities",
    icon: CheckSquare,
  },
  meetings: {
    label: "Meetings",
    description: "Meeting summaries and action items (no transcripts)",
    icon: Users,
  },
  deliverables: {
    label: "Deliverables",
    description: "Deliverable files and version history",
    icon: FileOutput,
  },
  invoicing: {
    label: "Invoicing",
    description: "Invoice list and payment status",
    icon: Receipt,
  },
  notes: {
    label: "Notes",
    description: "Shared notes and decisions",
    icon: StickyNote,
  },
  research: {
    label: "Research",
    description: "Research findings and analysis",
    icon: Search,
  },
};
```

#### Section B: Portal Users

A card showing invited users:

**Table columns:** Email, Status (badge), Invited Date, Last Login, Actions

**Status badges:**

- pending: yellow "Pending"
- accepted: green "Active"
- revoked: red "Revoked"

**Actions:**

- "Revoke" button (with confirmation dialog) — calls `revokePortalUser(id)`
- "Copy Invite Link" for pending invitations — copies the portal login URL

**Add User:**

- "Invite User" button opens a dialog
- Dialog has email input + "Send Invitation" button
- Calls `invitePortalUser(clientId, email)`
- Shows the generated invite link for the consultant to share
- Toast on success/error

### 3. Portal Link in Sidebar

**File:** `src/components/layout/sidebar.tsx`

The sidebar already has a "Shared with Client" link at the bottom (line 68):

```typescript
{ href: "/portal", label: "Shared with Client", icon: Share2 },
```

Keep this as-is. It links to the portal page (useful for consultants to preview what clients see).

### 4. Quick Toggle on CRM Detail Page

**File:** `src/components/crm/customer-detail-header.tsx`

Add a small "Client Portal" badge/indicator showing whether the portal is active for this client:

- If any modules are enabled: green badge "Portal Active"
- If no modules enabled: gray badge "Portal Inactive"
- Click on badge links to `/settings` (portal sharing section)

This is a simple visual indicator, not a full management UI.

## Tests

**File:** `src/__tests__/settings/portal-sharing.test.ts`

Test:

1. Module toggles render for all 7 modules
2. Toggle calls updatePortalSetting with correct params
3. Invitation table shows correct status badges
4. Invite dialog validates email format
5. Revoke button shows confirmation before revoking
6. Portal active indicator shows correctly based on settings

Run `npm test` to ensure no regressions.

## Acceptance Criteria

- [ ] Settings page has "Portal Sharing" section
- [ ] All 7 modules shown with toggle switches
- [ ] Toggling a module calls server action and shows toast
- [ ] Portal users table shows email, status, dates
- [ ] "Invite User" dialog accepts email and creates invitation
- [ ] "Revoke" button with confirmation removes access
- [ ] Portal active indicator on CRM detail header
- [ ] All existing tests pass (`npm test`)

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_05-sharing-management-ui.md`

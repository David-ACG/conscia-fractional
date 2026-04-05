# PROMPT: Portal Module Views

**Goal:** Implement the portal dashboard and all 7 read-only module views that clients can access.

## Context

FractionalBuddy's client portal has a layout with sidebar showing enabled modules (from previous prompt). This prompt builds the actual content pages clients see when they click each module.

### Prerequisites

- Portal layout exists at `src/app/(portal)/layout.tsx` with sidebar
- `client_portal_settings` table controls which modules are enabled per client
- `is_client_visible` boolean on all entities controls item-level visibility
- User has `client` role with `client_id` in JWT claims
- RLS policies already filter: `client_id = get_client_id() AND is_client_visible = true`
- All server actions use `createAdminClient` (bypasses RLS) — portal views need to use the server client (respects RLS) or explicitly filter by client_id + is_client_visible

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase with RLS
- Tailwind CSS v4 + shadcn/ui
- All pages are server components (async)

## Important: Data Access Pattern

Portal pages must use `createAdminClient` BUT filter explicitly by `client_id` and `is_client_visible = true`. This is because portal users authenticate via magic link and their session may not have the full JWT claims needed for RLS.

Alternative approach: Create a `createPortalClient` helper that uses the server client with proper session, letting RLS do the filtering. Test which approach works and use the simpler one.

The recommended approach:

1. Get the authenticated user via server client
2. Look up their `client_id` from `portal_invitations` or `user_roles`
3. Use admin client to query data filtered by that client_id + is_client_visible

Create a helper: `src/lib/actions/portal-data.ts`:

```typescript
async function getPortalClientId(): Promise<string | null> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: role } = await admin
    .from("user_roles")
    .select("client_id")
    .eq("user_id", user.id)
    .eq("role", "client")
    .single();

  return role?.client_id ?? null;
}
```

## Implementation

### 1. Portal Dashboard

**File:** `src/app/(portal)/portal/page.tsx`

Replace the placeholder with a real dashboard:

**Summary Cards** (top row, 4 cards):

- **Hours This Month**: Total billable hours for current month (from time_entries)
- **Open Tasks**: Count of tasks with status != 'done' (from tasks)
- **Next Meeting**: Date of the next upcoming meeting (from meetings)
- **Outstanding Balance**: Sum of unpaid invoices (from invoices where status != 'paid')

Only show cards for enabled modules. If timesheet is disabled, don't show "Hours This Month".

**Recent Activity** (below cards):
Show the 10 most recent items across all enabled modules, sorted by date:

- Deliverables: "Deliverable uploaded: {name}" with date
- Meetings: "Meeting summary: {title}" with date
- Tasks: "Task completed: {title}" with date
- Invoices: "Invoice sent: INV-{number}" with date

Use a simple list with icons and timestamps.

### 2. Dynamic Module Page

**File:** `src/app/(portal)/portal/[module]/page.tsx`

A single dynamic route that renders different content based on the `module` parameter.

```typescript
export default async function PortalModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  // Check if module is enabled
  const admin = createAdminClient();
  const { data: setting } = await admin
    .from("client_portal_settings")
    .select("is_enabled")
    .eq("client_id", clientId)
    .eq("module", module)
    .single();

  if (!setting?.is_enabled) notFound();

  // Render based on module
  switch (module) {
    case "timesheet": return <PortalTimesheet clientId={clientId} />;
    case "tasks": return <PortalTasks clientId={clientId} />;
    case "meetings": return <PortalMeetings clientId={clientId} />;
    case "deliverables": return <PortalDeliverables clientId={clientId} />;
    case "invoicing": return <PortalInvoicing clientId={clientId} />;
    case "notes": return <PortalNotes clientId={clientId} />;
    case "research": return <PortalResearch clientId={clientId} />;
    default: notFound();
  }
}
```

### 3. Portal Module Components

Create these components in `src/components/portal/`:

#### `portal-timesheet.tsx`

- Shows time entries grouped by week
- Columns: Date, Category, Description, Duration, Billable
- Weekly subtotals
- Monthly total at bottom
- Filter: date range picker (defaults to current month)
- Query: `time_entries WHERE client_id AND is_client_visible = true ORDER BY started_at DESC`

#### `portal-tasks.tsx`

- Shows active tasks (status != 'done') first, then completed
- Columns: Priority (badge), Title, Assignee, Due Date, Status (badge)
- Overdue tasks highlighted in red
- Query: `tasks WHERE client_id AND is_client_visible = true ORDER BY priority, created_at`

#### `portal-meetings.tsx`

- Shows meetings with summaries (no full transcripts)
- Columns: Date, Title, Duration, Attendees count
- Expandable row showing summary text (use react-markdown for rendering)
- Action items listed below summary
- Query: `meetings WHERE client_id AND is_client_visible = true ORDER BY meeting_date DESC`
- IMPORTANT: Do NOT include `transcript` field in the query (large text, not for client view)

#### `portal-deliverables.tsx`

- Shows deliverables with version info
- Columns: Name, Status (badge), Due Date, Version, Download link
- Overdue items highlighted
- Download button opens file_url in new tab
- Query: `deliverables WHERE client_id AND is_client_visible = true ORDER BY created_at DESC`

#### `portal-invoicing.tsx`

- Shows invoices
- Columns: Invoice #, Period, Days, Amount (£), Status (badge), Date
- Status badges: draft=gray, sent=blue, viewed=purple, overdue=red, paid=green
- Query: `invoices WHERE client_id AND is_client_visible = true ORDER BY created_at DESC`

#### `portal-notes.tsx`

- Shows notes marked as client-visible
- Card layout with title, content preview, note_type badge, date
- Click to expand full content (react-markdown rendering)
- Query: `notes WHERE client_id AND is_client_visible = true ORDER BY created_at DESC`

#### `portal-research.tsx`

- Shows research items marked as client-visible
- Card layout with title, content preview, research_type badge, tags, date
- Click to expand full content (react-markdown rendering)
- Query: `research WHERE client_id AND is_client_visible = true ORDER BY created_at DESC`

### 4. Shared Portal Components

**`src/components/portal/portal-summary-cards.tsx`**

- Reusable summary card grid (similar to customer-summary-cards.tsx)
- Each card: icon, label, value, optional link to module page

**`src/components/portal/portal-empty-state.tsx`**

- "No {items} shared yet" message with appropriate icon
- Used when a module has no visible items

## Tests

**File:** `src/__tests__/portal/portal-views.test.ts`

Test:

1. Dashboard renders summary cards for enabled modules only
2. Disabled modules return 404
3. Each module view renders correct columns/layout
4. Meeting view does NOT include transcript text
5. Data is filtered by is_client_visible (mock/verify query parameters)

Run `npm test` to ensure no regressions.

## Acceptance Criteria

- [ ] Portal dashboard shows summary cards (hours, tasks, meetings, balance)
- [ ] Summary cards only appear for enabled modules
- [ ] Recent activity feed shows latest items across modules
- [ ] Timesheet view shows entries grouped by week with totals
- [ ] Tasks view shows active/completed split with priority badges
- [ ] Meetings view shows summaries (no transcripts) with expandable details
- [ ] Deliverables view shows files with download links
- [ ] Invoicing view shows invoices with status badges
- [ ] Notes view shows client-visible notes with markdown rendering
- [ ] Research view shows client-visible research with markdown rendering
- [ ] Disabled modules return 404
- [ ] All data filtered by is_client_visible = true
- [ ] All existing tests pass (`npm test`)

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_04-portal-module-views.md`

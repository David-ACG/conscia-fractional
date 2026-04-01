# PROMPT: CRM Customer Detail Page (Mini-Dashboard)

## Context

FractionalBuddy is a Next.js 16 app for fractional executives managing multiple clients. Each client (e.g. Conscia) has CRM customers (e.g. LoveSac, Holt Renfrew). We need a per-customer detail page that acts as a mini-dashboard showing all data related to that customer.

## Task

Create the customer detail page at `/crm/[slug]` with:

1. Customer header with info and Google Drive link
2. Summary cards (hours, tasks, meetings, deliverables)
3. Tabbed sections showing filtered data per module

## Detailed Instructions

### 1. Route: `src/app/(dashboard)/crm/[slug]/page.tsx`

Server component that:

- Extracts `slug` from params
- Fetches the CRM customer by slug for the active client
- Fetches all related data in parallel (meetings, tasks, time_entries, assets, deliverables)
- Returns 404 if customer not found
- Renders the detail page component

**Data fetching pattern:**

```typescript
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";

// All queries use admin client (SYNCHRONOUS — no await on createClient)
const supabase = createClient();

// Fetch customer
const { data: customer } = await supabase
  .from("crm_customers")
  .select("*")
  .eq("client_id", clientId)
  .eq("slug", slug)
  .single();

// Parallel data fetch
const [meetingsRes, tasksRes, timeEntriesRes, assetsRes, deliverablesRes] =
  await Promise.all([
    supabase
      .from("meetings")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("meeting_date", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("started_at", { ascending: false }),
    // Assets: try crm_customer_id first, fall back to name matching
    supabase
      .from("assets")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("deliverables")
      .select("*")
      .eq("crm_customer_id", customer.id)
      .order("created_at", { ascending: false }),
  ]);
```

**IMPORTANT — Assets fallback:** The `crm_customer_id` column on assets may not exist yet (migration pending). Handle this gracefully:

- Try querying with `.eq("crm_customer_id", customer.id)` first
- If the column doesn't exist or returns empty, fall back to filtering by customer name in asset name/description:
  ```typescript
  const customerAssets = allAssets.filter(
    (a) =>
      a.name.toLowerCase().includes(customer.name.toLowerCase()) ||
      a.description?.toLowerCase().includes(customer.name.toLowerCase()),
  );
  ```

### 2. Customer Header Component (`src/components/crm/customer-detail-header.tsx`)

Client component showing:

- Back link to `/crm` (ChevronLeft icon + "Back to CRM")
- Customer name (large heading)
- Status badge (active/prospect/completed/lost — color-coded like CRM table)
- Industry tag
- Website link (external link icon)
- Google Drive link button (FolderOpen icon, opens in new tab) — only shown if `google_drive_url` is set
- Primary contact name
- Edit button that links to CRM edit (or opens the CRM form dialog)

### 3. Summary Cards Component (`src/components/crm/customer-summary-cards.tsx`)

4 cards in a grid (2x2 on mobile, 4x1 on desktop):

| Card             | Data                                                                       | Icon        |
| ---------------- | -------------------------------------------------------------------------- | ----------- |
| Hours This Month | Sum of `duration_minutes` from time_entries this month, formatted as Xh Ym | Clock       |
| Open Tasks       | Count of tasks where status is 'todo' or 'in_progress'                     | CheckSquare |
| Meetings         | Count of meetings total (or this month)                                    | Users       |
| Deliverables     | Count of deliverables where status is 'in_progress' or 'review'            | FileOutput  |

Each card: icon, large number, label, subtle link to that tab below.

### 4. Tabbed Content (`src/components/crm/customer-tabs.tsx`)

Use the same `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from shadcn/ui.

**5 tabs:**

#### Meetings Tab

- Reuse `TimeEntryList` would be wrong here — create a simple table or reuse patterns from `meeting-list.tsx`
- Show: Date, Title, Duration, Attendees count, Platform badge
- Click row → link to `/meetings` (or open detail sheet)
- If no meetings: "No meetings with {customer.name} yet."

#### Tasks Tab

- Simple table: Priority badge, Title, Assignee, Due Date, Status badge
- Same pattern as task-list.tsx table view but without the form/kanban
- If no tasks: "No tasks for {customer.name} yet."

#### Timesheet Tab

- Table: Date, Category, Description, Duration, Billable badge
- Total row at bottom with sum of hours
- If no entries: "No time logged for {customer.name} yet."

#### Assets Tab

- Grid of asset cards (reuse `AssetCard` component from `src/components/assets/asset-card.tsx`)
- If no assets: "No assets for {customer.name} yet."

#### Deliverables Tab

- Table: Name, Status badge, Due Date, Version
- Same pattern as deliverable-list.tsx but simplified (no edit/delete here)
- If no deliverables: "No deliverables for {customer.name} yet."

### 5. Page Layout

```
┌─────────────────────────────────────────────┐
│ ← Back to CRM                               │
│                                              │
│ LoveSac                        [Edit] [Drive]│
│ ● Active  |  Retail  |  lovesac.com         │
│ Primary: Amelia (VP Consumer Experience)     │
├─────────────────────────────────────────────┤
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐       │
│ │ 1.0h │ │  5   │ │  1   │ │  2   │       │
│ │Hours │ │Tasks │ │Meets │ │Deliv │       │
│ └──────┘ └──────┘ └──────┘ └──────┘       │
├─────────────────────────────────────────────┤
│ [Meetings] [Tasks] [Timesheet] [Assets] [Del]│
│                                              │
│ (Tab content here — filtered data tables)    │
│                                              │
└─────────────────────────────────────────────┘
```

## Key Patterns

- Server components fetch data, client components render UI
- Use `createAdminClient` (synchronous) for all DB queries
- Use `getActiveClientId()` for client scoping
- Reuse existing UI components where possible (Badge, Card, Table, Tabs)
- Follow existing color conventions for status badges

## Files to Create

- `src/app/(dashboard)/crm/[slug]/page.tsx`
- `src/components/crm/customer-detail-header.tsx`
- `src/components/crm/customer-summary-cards.tsx`
- `src/components/crm/customer-tabs.tsx`

## Files to Reference (read patterns from, do not modify)

- `src/components/meetings/meeting-list.tsx` — table pattern
- `src/components/tasks/task-list.tsx` — table pattern
- `src/components/timesheet/time-entry-list.tsx` — entry display
- `src/components/assets/asset-card.tsx` — card pattern
- `src/components/deliverables/deliverable-list.tsx` — table pattern
- `src/app/(dashboard)/dashboard/page.tsx` — summary card pattern

## Acceptance Criteria

1. `/crm/lovesac` renders the LoveSac customer detail page
2. Header shows: name, status badge, industry, website link, Google Drive link (if set)
3. Summary cards show correct counts for this customer's data
4. Meetings tab shows the "Conscia - LoveSac Project Kickoff" meeting
5. Tasks tab shows the 8 tasks created from the LoveSac meeting
6. Timesheet tab shows the 60-min meeting time entry
7. Assets tab shows the 7 LoveSac assets (via name matching or crm_customer_id)
8. Deliverables tab shows the 2 LoveSac deliverables
9. Back link navigates to `/crm`
10. All existing tests pass
11. Page handles missing customer gracefully (404/redirect)

## Test Expectations

- Run `npm test` — all 135 existing tests must pass
- No new test files required for this prompt

---

## Review Checklist — 2026-03-29 11:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Assets fallback (name matching) is clearly documented

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-29_crm-customer-detail-page.md`

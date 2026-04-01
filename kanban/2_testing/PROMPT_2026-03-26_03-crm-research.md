# PROMPT 03: CRM + Research Modules

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. CRM and Research pages are currently placeholders. Both tables exist in Supabase with RLS. The client switcher (Prompt 01) provides `getActiveClientId()`. Conscia already has 4 seeded CRM customers (Staples, JLR, Holt Renfrew, LoveSac).

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, react-hook-form, zod

**Prerequisite:** Prompt 01 (client switcher) must be complete.

## Database Schema (already exists — DO NOT create migrations)

### crm_customers

```
id uuid PK, client_id uuid FK, name text NOT NULL, slug text,
website text, industry text, description text, status text DEFAULT 'active',
primary_contact text, is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Status values: `prospect`, `active`, `completed`, `lost`

### research

```
id uuid PK, client_id uuid FK, title text NOT NULL, content text,
research_type text DEFAULT 'architecture', tags jsonb DEFAULT '[]',
is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Research type values: `architecture`, `competitor`, `technology`, `market`, `other`

## Types (already in `src/lib/types.ts`)

CrmCustomer and Research interfaces are already defined (but Research might not exist — check and add if needed):

If missing, add to `src/lib/types.ts`:

```typescript
export interface Research {
  id: string;
  client_id: string;
  title: string;
  content: string | null;
  research_type:
    | "architecture"
    | "competitor"
    | "technology"
    | "market"
    | "other";
  tags: string[];
  is_client_visible: boolean;
  created_at: string;
  updated_at: string;
}
```

## What to Build

### 1. CRM Server Actions (`src/lib/actions/crm.ts`)

```typescript
"use server";
// Follow contacts.ts pattern exactly

// createCustomer(data) — name, website, industry, description, status, primary_contact, is_client_visible
//   Auto-generate slug from name: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
//   Get clientId from getActiveClientId()
//   revalidatePath("/crm")

// updateCustomer(id, data)
// deleteCustomer(id)
```

### 2. CRM Page (`src/app/(dashboard)/crm/page.tsx`)

Replace placeholder. Server component:

```typescript
async function getCrmData() {
  const clientId = await getActiveClientId();
  // Fetch crm_customers where client_id = clientId
  // Also fetch counts of related tasks and deliverables per customer:
  //   tasks: count where crm_customer_id = customer.id
  //   deliverables: count where crm_customer_id = customer.id
  // Return { customers, taskCounts, deliverableCounts }
}
```

### 3. CRM Table Component (`src/components/crm/crm-table.tsx`)

"use client" — Table view (David specifically requested table, not cards):

**Toolbar:**

- Search input (filters name, industry)
- Status filter dropdown (All/Prospect/Active/Completed/Lost)
- "Add Customer" button

**Table columns:**
| Name | Industry | Status | Primary Contact | Tasks | Deliverables | Actions |
|------|----------|--------|----------------|-------|-------------|---------|

- Name: bold, with website link icon if website exists
- Industry: text-muted-foreground
- Status: colored badge (prospect=blue, active=green, completed=gray, lost=red)
- Primary Contact: text
- Tasks: count badge (link to /tasks filtered — just show count for now)
- Deliverables: count badge
- Actions: dropdown with Edit, Delete

Use shadcn Table component (`<Table>`, `<TableHeader>`, `<TableRow>`, `<TableCell>`).

Click row → opens edit form.

**Empty state:** "No customers yet. Add your first customer to start tracking."

### 4. CRM Form (`src/components/crm/crm-form.tsx`)

Dialog form:

- Fields: name (required), website, industry, description (textarea, 3 rows), status (select), primary_contact, is_client_visible (checkbox)
- Create/edit/delete pattern same as contacts
- Toast feedback

### 5. Research Server Actions (`src/lib/actions/research.ts`)

```typescript
"use server";
// createResearch(data) — title, content (markdown), research_type, tags, is_client_visible
// updateResearch(id, data)
// deleteResearch(id)
// getAllResearchTags(clientId) — aggregate unique tags across all research items
```

### 6. Research Page (`src/app/(dashboard)/research/page.tsx`)

Replace placeholder. Server component fetching research items filtered by clientId.

### 7. Research List Component (`src/components/research/research-list.tsx`)

"use client" component:

**Toolbar:**

- Search input (filters title, content)
- Type filter: toggle badges for each research_type (architecture, competitor, technology, market, other)
- "Add Research" button

**Grid:** `sm:grid-cols-1 lg:grid-cols-2` — research items need more horizontal space for content preview

### 8. Research Card (`src/components/research/research-card.tsx`)

Card showing:

- Research type badge (top-right, color-coded):
  - architecture: purple
  - competitor: orange
  - technology: blue
  - market: green
  - other: gray
- Title (bold)
- Content preview (first 200 chars of markdown, stripped of markdown syntax)
- Tags as small badges
- Created date
- Click opens edit form

### 9. Research Form (`src/components/research/research-form.tsx`)

Dialog form (larger than other forms — `max-w-2xl`):

- Fields:
  - title (required)
  - research_type (select: Architecture/Competitor/Technology/Market/Other)
  - content (textarea, 16 rows — this is markdown content, so needs space)
  - tags (TagInput)
  - is_client_visible (checkbox)
- Placeholder text for content: "Write your research notes in markdown..."
- Note: File attachments are deferred to Phase 3 (when Supabase Storage is set up). Add a small muted note: "File attachments coming soon" below the content field.
- Create/edit/delete pattern
- Toast feedback

## Acceptance Criteria

- [ ] CRM page shows table of customers filtered by selected client
- [ ] CRM table has search and status filter
- [ ] CRM shows task and deliverable counts per customer
- [ ] Create/edit/delete CRM customers via dialog form
- [ ] Status badges color-coded
- [ ] Research page shows grid of research items filtered by selected client
- [ ] Research type filter as toggle badges
- [ ] Create/edit/delete research items
- [ ] Research content field is large (16 rows) for markdown
- [ ] Research type badges color-coded
- [ ] Tags work on research items (reuse TagInput)
- [ ] All forms validate with zod
- [ ] Toast feedback on all operations
- [ ] Existing tests pass (`npm test`)
- [ ] New tests: crm.test.ts, research.test.ts

## Test Expectations

`src/lib/actions/__tests__/crm.test.ts`:

- Test createCustomer with valid data + slug generation
- Test updateCustomer
- Test deleteCustomer

`src/lib/actions/__tests__/research.test.ts`:

- Test createResearch with valid data
- Test updateResearch
- Test deleteResearch
- Test getAllResearchTags aggregation

## Files to Create

- `src/lib/actions/crm.ts`
- `src/lib/actions/research.ts`
- `src/lib/actions/__tests__/crm.test.ts`
- `src/lib/actions/__tests__/research.test.ts`
- `src/components/crm/crm-table.tsx`
- `src/components/crm/crm-form.tsx`
- `src/components/research/research-list.tsx`
- `src/components/research/research-card.tsx`
- `src/components/research/research-form.tsx`

## Files to Modify

- `src/app/(dashboard)/crm/page.tsx` — replace placeholder
- `src/app/(dashboard)/research/page.tsx` — replace placeholder
- `src/lib/types.ts` — add Research type if not already present

---

## Review Checklist — 2026-03-26 19:40

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] CRM is table view (not cards) as David requested
- [ ] Research attachments correctly deferred

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-26_03-crm-research.md`

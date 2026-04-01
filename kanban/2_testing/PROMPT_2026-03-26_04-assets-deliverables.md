# PROMPT 04: Assets + Deliverables Modules

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. Assets and Deliverables pages are placeholders. Both tables exist in Supabase with RLS. The client switcher (Prompt 01) provides `getActiveClientId()`.

- **Assets** = templates, diagrams, documents you USE (metadata + external link)
- **Deliverables** = things you PRODUCE for the client (with version history)

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, react-hook-form, zod

**Prerequisite:** Prompt 01 (client switcher) must be complete.

## Database Schema (already exists — DO NOT create migrations)

### assets

```
id uuid PK, client_id uuid FK, name text NOT NULL, description text,
asset_type text DEFAULT 'template', file_url text, file_name text,
file_size_bytes bigint, is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Asset type values: `template`, `diagram`, `document`, `other`

### deliverables

```
id uuid PK, client_id uuid FK, crm_customer_id uuid FK nullable,
name text NOT NULL, description text, status text DEFAULT 'draft',
due_date date, file_url text, file_name text, version integer DEFAULT 1,
is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Status values: `draft`, `in_progress`, `review`, `delivered`

### deliverable_versions (needs to be created)

The deliverables table has a `version` column but no version history table. We need a new table and migration for version tracking.

Create `supabase/migrations/003_deliverable_versions.sql`:

```sql
CREATE TABLE public.deliverable_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deliverable_id uuid NOT NULL REFERENCES public.deliverables(id) ON DELETE CASCADE,
  version integer NOT NULL,
  notes text,
  file_url text,
  file_name text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.deliverable_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Consultant full access to deliverable_versions"
  ON public.deliverable_versions FOR ALL
  USING (public.is_consultant())
  WITH CHECK (public.is_consultant());

CREATE POLICY "Client read own deliverable_versions"
  ON public.deliverable_versions FOR SELECT
  USING (
    public.get_app_role() = 'client'
    AND EXISTS (
      SELECT 1 FROM public.deliverables d
      WHERE d.id = deliverable_versions.deliverable_id
      AND d.client_id = public.get_client_id()
      AND d.is_client_visible = true
    )
  );

CREATE INDEX idx_deliverable_versions_deliverable ON public.deliverable_versions(deliverable_id);
```

Also add the DeliverableVersion type to `src/lib/types.ts`:

```typescript
export interface DeliverableVersion {
  id: string;
  deliverable_id: string;
  version: number;
  notes: string | null;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}
```

## What to Build

### 1. Assets Server Actions (`src/lib/actions/assets.ts`)

```typescript
"use server";
// createAsset(data) — name, description, asset_type, file_url, file_name, is_client_visible
//   Get clientId from getActiveClientId()
//   revalidatePath("/assets")

// updateAsset(id, data)
// deleteAsset(id)
```

### 2. Assets Page (`src/app/(dashboard)/assets/page.tsx`)

Replace placeholder. Server component fetching assets filtered by clientId.

### 3. Asset List Component (`src/components/assets/asset-list.tsx`)

"use client" component:

**Toolbar:**

- Search input (filters name, description)
- Type filter: dropdown or toggle badges (Template/Diagram/Document/Other/All)
- "Add Asset" button

**Grid:** `sm:grid-cols-2 lg:grid-cols-3`

Each asset card shows:

- Asset type icon (top-left):
  - template: FileText (lucide)
  - diagram: GitBranch or Network
  - document: File
  - other: Package
- Name (bold)
- Description (truncated, 2 lines, text-muted-foreground)
- Asset type badge
- file_url as "Open Link" button (if present, opens in new tab)
- Created date
- Click card → opens edit form

**Empty state:** "No assets yet. Add templates, diagrams, and documents you use."

### 4. Asset Form (`src/components/assets/asset-form.tsx`)

Dialog form:

- Fields:
  - name (required)
  - description (textarea, 3 rows)
  - asset_type (select: Template/Diagram/Document/Other)
  - file_url (text input — external URL to the asset, e.g. Google Drive, Confluence link)
  - file_name (text, auto-populated from URL if possible, or manual)
  - is_client_visible (checkbox)
- Note: Direct file upload to Supabase Storage is deferred. For now, users paste external URLs.
- Create/edit/delete pattern
- Toast feedback

### 5. Deliverables Server Actions (`src/lib/actions/deliverables.ts`)

```typescript
"use server";
// createDeliverable(data) — name, description, status, due_date, file_url, file_name, crm_customer_id, is_client_visible
//   Get clientId from getActiveClientId()
//   Also create first entry in deliverable_versions (version 1, notes: "Initial version")
//   revalidatePath("/deliverables")

// updateDeliverable(id, data)
//   When file_url changes or status changes to a new milestone:
//     Auto-increment version on deliverables table
//     Insert new deliverable_versions row

// deleteDeliverable(id)
//   Cascade deletes versions automatically (FK ON DELETE CASCADE)

// createNewVersion(deliverableId, data: { notes, file_url, file_name })
//   Explicit "publish new version" action
//   Increment deliverables.version
//   Insert deliverable_versions row
//   revalidatePath("/deliverables")

// getVersionHistory(deliverableId) → DeliverableVersion[]
//   SELECT * FROM deliverable_versions WHERE deliverable_id = id ORDER BY version DESC
```

### 6. Deliverables Page (`src/app/(dashboard)/deliverables/page.tsx`)

Replace placeholder. Server component:

```typescript
async function getDeliverablesData() {
  const clientId = await getActiveClientId();
  // Fetch deliverables with nested CRM customer name:
  //   .select("*, crm_customer:crm_customers(name)")
  //   .eq("client_id", clientId)
  //   .order("due_date", { ascending: true })
  // Return { deliverables }
}
```

### 7. Deliverable List Component (`src/components/deliverables/deliverable-list.tsx`)

"use client" component:

**Toolbar:**

- Search input (filters name, description)
- Status filter: toggle badges (All/Draft/In Progress/Review/Delivered)
- "Add Deliverable" button

**Table view** (deliverables benefit from table for due dates and versions):

| Name | Customer | Status | Due Date | Version | Actions |
| ---- | -------- | ------ | -------- | ------- | ------- |

- Name: bold
- Customer: CRM customer name or "—" if none
- Status: colored badge:
  - draft: gray
  - in_progress: blue
  - review: amber
  - delivered: green
- Due Date: formatted date, red if overdue, amber if within 3 days
- Version: "v{number}" badge
- Actions: dropdown with Edit, New Version, View History, Delete

Use shadcn Table component.

**Empty state:** "No deliverables yet. Track documents and artifacts you produce."

### 8. Deliverable Form (`src/components/deliverables/deliverable-form.tsx`)

Dialog form:

- Fields:
  - name (required)
  - description (textarea, 3 rows)
  - crm_customer_id (select from CRM customers — pass customers list as prop, optional)
  - status (select: Draft/In Progress/Review/Delivered)
  - due_date (date input)
  - file_url (text — external link)
  - file_name (text)
  - is_client_visible (checkbox)
- Create/edit/delete pattern
- Toast feedback

### 9. Version History Component (`src/components/deliverables/version-history.tsx`)

Dialog or Sheet showing version history for a deliverable:

```
"use client"
// Props: { deliverableId: string, deliverableName: string, open: boolean, onOpenChange }
// Fetches version history on mount via server action
// Shows list of versions (newest first):
//   - Version number badge (v1, v2, v3...)
//   - Notes text
//   - File link (if present)
//   - Created date
//   - First version highlighted as "Initial"
```

Use a Sheet (slides in from right) for this — it's supplementary detail.

### 10. New Version Dialog (`src/components/deliverables/new-version-dialog.tsx`)

Small dialog for publishing a new version:

- Fields:
  - notes (textarea, 3 rows — "What changed in this version?")
  - file_url (text — new file link, optional)
  - file_name (text, optional)
- On submit: calls createNewVersion server action
- Toast feedback

## Run the Migration

After creating the migration file, the prompt executor must run it against Supabase. Add this note at the top of the implementation:

```
IMPORTANT: Run the migration file supabase/migrations/003_deliverable_versions.sql
against the Supabase database before testing deliverable version features.
Use the Supabase SQL Editor or dashboard to execute it.
```

## Acceptance Criteria

- [ ] Assets page shows grid of assets filtered by selected client
- [ ] Asset type filter works (toggle badges)
- [ ] Create/edit/delete assets via dialog
- [ ] Assets show external link button when file_url exists
- [ ] Asset type icons differentiate template/diagram/document/other
- [ ] Deliverables page shows table filtered by selected client
- [ ] Deliverable status filter as toggle badges
- [ ] Create/edit/delete deliverables
- [ ] Due dates show overdue/upcoming visual indicators
- [ ] CRM customer name shown in deliverable table
- [ ] "New Version" action increments version and adds history entry
- [ ] Version history Sheet shows all versions newest-first
- [ ] First deliverable creation auto-creates version 1
- [ ] Migration file created for deliverable_versions table
- [ ] All forms validate with zod
- [ ] Toast feedback on all operations
- [ ] Existing tests pass (`npm test`)
- [ ] New tests: assets.test.ts, deliverables.test.ts

## Test Expectations

`src/lib/actions/__tests__/assets.test.ts`:

- Test createAsset with valid data
- Test updateAsset
- Test deleteAsset

`src/lib/actions/__tests__/deliverables.test.ts`:

- Test createDeliverable creates version 1 automatically
- Test createNewVersion increments version number
- Test getVersionHistory returns versions in desc order
- Test deleteDeliverable (cascade deletes versions)

## Files to Create

- `supabase/migrations/003_deliverable_versions.sql`
- `src/lib/actions/assets.ts`
- `src/lib/actions/deliverables.ts`
- `src/lib/actions/__tests__/assets.test.ts`
- `src/lib/actions/__tests__/deliverables.test.ts`
- `src/components/assets/asset-list.tsx`
- `src/components/assets/asset-form.tsx`
- `src/components/deliverables/deliverable-list.tsx`
- `src/components/deliverables/deliverable-form.tsx`
- `src/components/deliverables/version-history.tsx`
- `src/components/deliverables/new-version-dialog.tsx`

## Files to Modify

- `src/app/(dashboard)/assets/page.tsx` — replace placeholder
- `src/app/(dashboard)/deliverables/page.tsx` — replace placeholder
- `src/lib/types.ts` — add DeliverableVersion type

---

## Review Checklist — 2026-03-26 19:40

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Version history approach is correct (separate table + Sheet UI)
- [ ] Migration file is included for deliverable_versions
- [ ] File upload correctly deferred (external URLs only for now)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-26_04-assets-deliverables.md`

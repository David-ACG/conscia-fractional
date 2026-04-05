# PROMPT: CRM Customer Auto-Linking

**Goal:** Fix CRM customer detail pages to use `crm_customer_id` properly for all entities, and ensure all entity creation forms include CRM customer selection.

## Context

The CRM customer detail page at `src/app/(dashboard)/crm/[slug]/page.tsx` currently:

- Queries assets by fetching ALL client assets then text-matching on customer name (fragile, misses items)
- Queries meetings, tasks, time_entries, deliverables correctly by `crm_customer_id`

The asset query needs to be fixed to use `crm_customer_id` as the primary filter, with text matching as fallback for legacy data.

Additionally, entity creation forms should all include a CRM customer dropdown so new items get properly linked.

## Stack

- Next.js 16 + React 19 + TypeScript
- Supabase (PostgreSQL + RLS)
- Tailwind CSS v4 + shadcn/ui
- Vitest for unit tests

## Files to Modify

### 1. Fix CRM Customer Detail Asset Query

**File:** `src/app/(dashboard)/crm/[slug]/page.tsx`

Currently (lines 66-80):

```typescript
// Fetches ALL assets for client, then filters by name
const allAssets = (assetsRes.data ?? []) as Asset[];
const customerName = customer.name.toLowerCase();
const customerAssets = allAssets.filter(
  (a) =>
    a.name.toLowerCase().includes(customerName) ||
    a.description?.toLowerCase().includes(customerName),
);
```

Change the assets query to:

```typescript
// Primary: query by crm_customer_id
supabase
  .from("assets")
  .select("*")
  .eq("crm_customer_id", customer.id)
  .order("created_at", { ascending: false }),
```

Then in the data processing, also include text-matched assets that don't have a crm_customer_id set (for legacy data):

```typescript
const linkedAssets = (assetsRes.data ?? []) as Asset[];
// Also find unlinked assets that match by name (legacy)
const allClientAssets = (allClientAssetsRes.data ?? []) as Asset[];
const customerName = customer.name.toLowerCase();
const textMatched = allClientAssets.filter(
  (a) =>
    !a.crm_customer_id && // Only unlinked assets
    (a.name.toLowerCase().includes(customerName) ||
      a.description?.toLowerCase().includes(customerName)),
);
// Combine, deduplicate
const customerAssets = [
  ...linkedAssets,
  ...textMatched.filter((t) => !linkedAssets.some((l) => l.id === t.id)),
];
```

This requires two parallel queries: one by crm_customer_id, one for all client assets (unlinked only).

### 2. Add CRM Customer Dropdown to Forms

Check each of these forms and ensure they have a CRM customer dropdown:

- **`src/components/tasks/task-form.tsx`** — Check if crm_customer_id field exists. If not, add a dropdown populated from `/api/crm-customers?clientId=...`
- **`src/components/timesheet/time-entry-form.tsx`** or wherever new time entries are created — Add crm_customer_id field
- **`src/components/assets/asset-form.tsx`** — Should already have this (migration 005 added crm_customer_id to assets). Verify it works.
- **`src/components/deliverables/deliverable-form.tsx`** — Should already have this. Verify it works.
- **`src/components/meetings/file-upload-transcription.tsx`** — When uploading meeting recordings, allow selecting a CRM customer

For each form, the dropdown should:

- Fetch CRM customers from the API: `GET /api/crm-customers?clientId={clientId}`
- Show "None" as default option
- Set `crm_customer_id` on the created entity
- Use the existing `useClient()` hook to get `clientId`

### 3. Add Bulk-Link UI for Existing Assets

**New component:** `src/components/crm/bulk-link-assets.tsx`

A simple UI shown on the CRM customer detail page (Assets tab) that:

1. Lists unlinked assets that match the customer name via text
2. Shows a "Link to {customerName}" button next to each
3. Clicking updates the asset's `crm_customer_id`

**New server action in `src/lib/actions/assets.ts`:**

```typescript
export async function linkAssetToCustomer(
  assetId: string,
  crmCustomerId: string,
) {
  // Update asset's crm_customer_id
}
```

### 4. Update Asset List Customer Filter

**File:** `src/components/assets/asset-list.tsx`

The `getAssetCustomer` function (lines 57-74) already checks `crm_customer_id` first, falling back to text matching. This is correct. No changes needed here.

## Tests

### Unit Tests

**File:** `src/__tests__/crm/customer-linking.test.ts`

Test the asset query logic:

1. Assets with matching `crm_customer_id` are included
2. Unlinked assets with matching name text are included as fallback
3. Assets linked to a different customer are excluded
4. Deduplication works (asset appears in both linked and text-matched)

### Existing Tests

Run `npm test` to ensure no regressions.

## Acceptance Criteria

- [ ] CRM customer detail page shows assets linked by `crm_customer_id` (primary)
- [ ] Legacy unlinked assets still appear via text matching fallback
- [ ] Task form includes CRM customer dropdown
- [ ] Time entry form includes CRM customer dropdown
- [ ] Meeting upload form includes CRM customer dropdown
- [ ] Asset form CRM customer dropdown works correctly
- [ ] Deliverable form CRM customer dropdown works correctly
- [ ] Bulk-link button on Assets tab links unlinked assets to customer
- [ ] All existing tests pass (`npm test`)
- [ ] New unit tests for customer linking logic pass

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_01-crm-customer-auto-linking.md`

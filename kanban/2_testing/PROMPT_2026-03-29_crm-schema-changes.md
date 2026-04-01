# PROMPT: CRM Schema Changes — Google Drive URL + Assets Customer Column

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. The CRM module manages customers (e.g. LoveSac, Holt Renfrew) under a parent client (e.g. Conscia). We need to add a Google Drive URL field to CRM customers and a `crm_customer_id` foreign key to the assets table.

## Task

1. Create a SQL migration file
2. Update TypeScript types
3. Update validation schemas
4. Update server actions
5. Update CRM form to include Google Drive URL field
6. Update Asset form to include optional customer dropdown

## Detailed Instructions

### 1. Migration File

Create `supabase/migrations/005_crm_google_drive_assets_customer.sql`:

```sql
-- Add Google Drive URL to CRM customers
ALTER TABLE public.crm_customers ADD COLUMN IF NOT EXISTS google_drive_url text;

-- Add customer association to assets
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS crm_customer_id uuid REFERENCES public.crm_customers(id) ON DELETE SET NULL;
```

### 2. TypeScript Types (`src/lib/types.ts`)

Add `google_drive_url: string | null` to the `CrmCustomer` interface (after `primary_contact`).
Add `crm_customer_id: string | null` to the `Asset` interface (after `client_id`).

### 3. CRM Validation Schema (`src/lib/validations/crm.ts`)

Add to the Zod schema:

```typescript
google_drive_url: z.string().url().or(z.literal("")).optional().default(""),
```

### 4. CRM Server Actions (`src/lib/actions/crm.ts`)

In `createCustomer` and `updateCustomer`, add `google_drive_url: parsed.data.google_drive_url || null` to the insert/update object.

### 5. CRM Form (`src/components/crm/crm-form.tsx`)

Add a "Google Drive URL" text input field after the Website field. Use the same pattern as the website field (optional URL).

### 6. Asset Validation Schema (`src/lib/validations/assets.ts`)

Add to the Zod schema:

```typescript
crm_customer_id: z.string().optional().default(""),
```

### 7. Asset Server Actions (`src/lib/actions/assets.ts`)

In `createAsset` and `updateAsset`, add `crm_customer_id: parsed.data.crm_customer_id || null` to the insert/update object.

### 8. Asset Form (`src/components/assets/asset-form.tsx`)

Add a "Customer" dropdown (Select component) that lists CRM customers for the active client. This should be optional — if no customer selected, the asset belongs to the parent client (Conscia).

The asset form will need customers passed as a prop. Update the AssetList component to accept and pass customers down. Update the Assets page (`src/app/(dashboard)/assets/page.tsx`) — it already fetches customers, just pass them to AssetForm via AssetList.

## Key Patterns

- All server actions use `createAdminClient as createClient` from `@/lib/supabase/admin` (SYNCHRONOUS, no await)
- All exported functions in `"use server"` files must be `async`
- Use `revalidatePath()` after mutations
- Forms use `react-hook-form` with `zodResolver`

## Files to Modify

- `supabase/migrations/005_crm_google_drive_assets_customer.sql` (CREATE)
- `src/lib/types.ts`
- `src/lib/validations/crm.ts`
- `src/lib/validations/assets.ts`
- `src/lib/actions/crm.ts`
- `src/lib/actions/assets.ts`
- `src/components/crm/crm-form.tsx`
- `src/components/assets/asset-form.tsx`
- `src/components/assets/asset-list.tsx` (pass customers to form)
- `src/app/(dashboard)/assets/page.tsx` (already fetches customers — pass to AssetList)

## Acceptance Criteria

1. Migration SQL file exists and is valid
2. CrmCustomer type has `google_drive_url: string | null`
3. Asset type has `crm_customer_id: string | null`
4. CRM form shows Google Drive URL field, saves correctly
5. Asset form shows optional Customer dropdown, saves correctly
6. All 135 existing tests pass
7. No TypeScript errors

## Test Expectations

- Run `npm test` — all existing tests must pass
- No new test files needed for this prompt (schema changes only)

---

## Review Checklist — 2026-03-29 11:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-29_crm-schema-changes.md`

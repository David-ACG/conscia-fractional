# PLAN: CRM Expandable Sidebar + Customer Detail Pages

**Date:** 2026-03-29
**Priority:** High
**Type:** Feature

## Summary

Transform the CRM section from a flat list into an expandable sidebar with per-customer detail pages. Each customer gets a mini-dashboard showing their meetings, tasks, timesheet, assets, and deliverables. Add Google Drive URL field to CRM customers. Rename "Contacts" to dynamic client-name contacts.

## Scope

### In Scope

1. **Expandable CRM sidebar** — CRM nav item expands to show top 10 customers as sub-items + "View all" link
2. **Customer detail page** (`/crm/[slug]`) — mini-dashboard per customer with:
   - Header: name, status, industry, website, Google Drive link, primary contact
   - Summary cards: hours this month, open tasks, upcoming meetings, deliverables in progress
   - Tabbed sections: Meetings | Tasks | Timesheet | Assets | Deliverables
3. **Google Drive URL field** — new `google_drive_url` column on `crm_customers` table, editable in CRM form
4. **Assets `crm_customer_id` column** — DB migration + update asset form to support customer association
5. **Rename "Contacts"** — sidebar label becomes dynamic: "{ClientName} Contacts" (e.g. "Conscia Contacts")

### Out of Scope

- Google Drive API integration (future — requires OAuth2 per-client)
- Calendar integration on customer detail page (Calendar module not built yet)
- File upload to Supabase Storage

## Technical Approach

### Prompt 1: DB Migration + Schema Changes

- Add `google_drive_url text` to `crm_customers`
- Add `crm_customer_id uuid` to `assets` (the pending migration)
- Update TypeScript types, validation schemas, and CRM form
- Generate migration SQL file for David to run in Supabase dashboard

### Prompt 2: Expandable CRM Sidebar + Contacts Rename

- Modify `sidebar.tsx` to make CRM expandable with customer sub-list
- Fetch customers via `/api/clients` pattern (admin client, no RLS issues)
- Create `/api/crm-customers` API route for sidebar data
- Top 10 customers by status (active first), "View all" links to `/crm`
- Click customer → navigates to `/crm/[slug]`
- Rename "Contacts" to dynamic "{ClientName} Contacts"

### Prompt 3: Customer Detail Page

- New route: `src/app/(dashboard)/crm/[slug]/page.tsx`
- Server component that fetches all customer data in parallel
- Header section with customer info + Google Drive link button
- 4 summary cards (hours, tasks, meetings, deliverables)
- Tabbed content area reusing existing list components with filtered data
- For assets: use name-matching until migration is run, then use `crm_customer_id`

## Files Affected

### New Files

- `supabase/migrations/005_crm_google_drive_assets_customer.sql`
- `src/app/api/crm-customers/route.ts`
- `src/app/(dashboard)/crm/[slug]/page.tsx`
- `src/components/crm/customer-detail.tsx`
- `src/components/crm/customer-summary-cards.tsx`

### Modified Files

- `src/lib/types.ts` — add `google_drive_url` to CrmCustomer, add `crm_customer_id` to Asset
- `src/lib/validations/crm.ts` — add `google_drive_url` field
- `src/lib/actions/crm.ts` — handle `google_drive_url` in create/update
- `src/components/crm/crm-form.tsx` — add Google Drive URL field
- `src/components/layout/sidebar.tsx` — expandable CRM section + dynamic Contacts label
- `src/lib/validations/assets.ts` — add optional `crm_customer_id`
- `src/lib/actions/assets.ts` — handle `crm_customer_id` in create/update
- `src/components/assets/asset-form.tsx` — add customer dropdown

## Acceptance Criteria

1. CRM in sidebar expands to show customer sub-list (top 10, active first)
2. Clicking a customer navigates to `/crm/[slug]`
3. Customer detail page shows header with all info including Google Drive link
4. Summary cards show correct counts (hours, tasks, meetings, deliverables)
5. Tabbed sections show filtered data for that customer only
6. Google Drive URL field works in CRM form (create + edit)
7. "Contacts" label in sidebar shows "{ClientName} Contacts"
8. "View all" link in sidebar CRM section goes to `/crm`
9. All existing tests pass (135 unit tests)
10. Assets form allows selecting a CRM customer

## Estimated Complexity

- Prompt 1 (DB + Schema): Small — schema changes and form updates
- Prompt 2 (Sidebar): Medium — sidebar refactor with expandable section + API route
- Prompt 3 (Detail Page): Large — new page with multiple data sources and tabbed UI

---

## Review Checklist — 2026-03-29 11:30

- [ ] Scope is correctly bounded (not too broad, not too narrow)
- [ ] Technical approach matches the project's stack and conventions
- [ ] Files affected list is complete and accurate
- [ ] Acceptance criteria are specific and testable
- [ ] No unexpected dependencies introduced
- [ ] Estimated complexity feels right
- [ ] Google Drive URL is simple text field (no API complexity)
- [ ] Name-matching fallback for assets is documented

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-03-29_crm-customer-pages.md`

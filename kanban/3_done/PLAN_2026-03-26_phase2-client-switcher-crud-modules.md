# PLAN: Phase 2 — Multi-Client Support + CRUD Modules

**Date:** 2026-03-26
**Phase:** 2 of 4
**Depends on:** Phase 1 (complete)

## Goal

Replace all 6 placeholder pages (Tasks, Notes, CRM, Research, Assets, Deliverables) with real implementations, and add multi-client support so David can manage 5+ clients from one app. Calendar, Meetings, Invoicing, and Portal are deferred to Phase 3.

## Architecture Decisions

### Client Switcher

- **Location:** Sidebar header, Slack-style workspace switcher dropdown
- **Persistence:** `selectedClientId` stored in a React context + localStorage
- **Data flow:** All pages read `useClient()` hook → pass client_id to server actions / data fetches
- **"+ Add Client" button** at bottom of dropdown opens a dialog (name, industry, role_title, day_rate, hours_per_week)
- **Dashboard adapts:** Hours card, engagement card, activity feed all filter by selected client
- **URL:** No client in URL (context-based, like Slack). Simpler than URL-based routing.

### Module Pattern (all 6 modules follow this)

- **Page:** Async server component, fetches data, passes to client component
- **List component:** Client component with search/filter, grid or table layout
- **Form component:** Dialog with react-hook-form + zod, create/edit modes
- **Server actions:** CRUD operations with `createClient()` → query → `revalidatePath()`
- **All tables already exist** in the DB with RLS policies. No schema changes needed.

### Client Context Threading

- Current code hardcodes `engagement.eq("status", "active").limit(1).single()` to find client_id
- Phase 2 changes: server actions accept `clientId` parameter explicitly
- Pages pass `clientId` from context to data-fetching functions
- Existing pages (Dashboard, Timesheet, Contacts, Engagement) must be updated to use the client context

## Prompts

| #   | Prompt                | Modules                      | Key Deliverables                                                                                                                                 |
| --- | --------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Client Switcher       | Client switching, Add Client | ClientProvider context, ClientSwitcher dropdown, Add Client dialog, update sidebar/header/dashboard/timesheet/contacts/engagement to use context |
| 2   | Tasks + Notes         | Tasks, Notes                 | Task list + kanban toggle, task form, notes list with type filter, note form with markdown                                                       |
| 3   | CRM + Research        | CRM, Research                | CRM table view, CRM form, research page with markdown + tags                                                                                     |
| 4   | Assets + Deliverables | Assets, Deliverables         | Asset list + metadata, deliverable list with version history                                                                                     |

## Acceptance Criteria (Phase 2 overall)

- [ ] Client switcher in sidebar allows switching between clients
- [ ] "+ Add Client" creates client + engagement in one flow
- [ ] All 6 placeholder pages replaced with working CRUD implementations
- [ ] Dashboard, Timesheet, Contacts, Engagement filter by selected client
- [ ] All pages follow existing patterns (server component → client component → server actions)
- [ ] All forms use react-hook-form + zod validation
- [ ] All lists have search/filter capability
- [ ] Tasks page has list view + kanban toggle
- [ ] Notes page has type filter badges
- [ ] CRM uses table view
- [ ] Research supports markdown content
- [ ] Deliverables have version history
- [ ] Existing tests still pass (`npm test`)
- [ ] New tests for server actions

## Out of Scope (Phase 3+)

- Calendar (Google/MS API integration)
- Meetings (transcription, Deepgram)
- Invoicing (FreeAgent API)
- Client Portal (magic links, /portal routes)
- File upload to Supabase Storage (research attachments — placeholder for now)

## Files Affected

### New files

- `src/lib/client-context.tsx` — ClientProvider + useClient hook
- `src/components/layout/client-switcher.tsx` — Dropdown component
- `src/components/layout/add-client-dialog.tsx` — Add client + engagement form
- `src/lib/actions/clients.ts` — Client CRUD actions
- `src/lib/actions/tasks.ts` — Task CRUD actions
- `src/lib/actions/notes.ts` — Note CRUD actions
- `src/lib/actions/crm.ts` — CRM customer CRUD actions
- `src/lib/actions/research.ts` — Research CRUD actions
- `src/lib/actions/assets.ts` — Asset CRUD actions
- `src/lib/actions/deliverables.ts` — Deliverable CRUD actions
- `src/components/tasks/task-list.tsx`
- `src/components/tasks/task-kanban.tsx`
- `src/components/tasks/task-form.tsx`
- `src/components/tasks/task-card.tsx`
- `src/components/notes/note-list.tsx`
- `src/components/notes/note-form.tsx`
- `src/components/notes/note-card.tsx`
- `src/components/crm/crm-table.tsx`
- `src/components/crm/crm-form.tsx`
- `src/components/research/research-list.tsx`
- `src/components/research/research-form.tsx`
- `src/components/research/research-card.tsx`
- `src/components/assets/asset-list.tsx`
- `src/components/assets/asset-form.tsx`
- `src/components/deliverables/deliverable-list.tsx`
- `src/components/deliverables/deliverable-form.tsx`
- `src/components/deliverables/version-history.tsx`

### Modified files

- `src/components/layout/sidebar.tsx` — Add ClientSwitcher at top
- `src/app/(dashboard)/layout.tsx` — Wrap with ClientProvider
- `src/app/(dashboard)/dashboard/page.tsx` — Accept clientId prop
- `src/app/(dashboard)/timesheet/page.tsx` — Accept clientId prop
- `src/app/(dashboard)/contacts/page.tsx` — Accept clientId prop
- `src/app/(dashboard)/engagement/page.tsx` — Accept clientId prop
- `src/lib/actions/contacts.ts` — Accept clientId parameter instead of hardcoding
- `src/lib/actions/engagement.ts` — Accept clientId parameter
- `src/app/(dashboard)/tasks/page.tsx` — Replace placeholder
- `src/app/(dashboard)/notes/page.tsx` — Replace placeholder
- `src/app/(dashboard)/crm/page.tsx` — Replace placeholder
- `src/app/(dashboard)/research/page.tsx` — Replace placeholder
- `src/app/(dashboard)/assets/page.tsx` — Replace placeholder
- `src/app/(dashboard)/deliverables/page.tsx` — Replace placeholder

---

## Review Checklist — 2026-03-26 19:40

- [ ] Scope is correctly bounded (not too broad, not too narrow)
- [ ] Technical approach matches the project's stack and conventions
- [ ] Files affected list is complete and accurate
- [ ] Acceptance criteria are specific and testable
- [ ] No unexpected dependencies introduced
- [ ] Estimated complexity feels right
- [ ] Client context approach is sound (context + localStorage vs URL-based)

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-03-26_phase2-client-switcher-crud-modules.md`

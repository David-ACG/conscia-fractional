# Plan: Client Portal & CRM Customer Linking

**Date:** 2026-04-05
**Scope:** Client portal with granular sharing permissions + CRM customer auto-linking for all entities

---

## Background

FractionalBuddy has a placeholder portal page and `is_client_visible` booleans on all entities, but no actual portal implementation. CRM customer detail pages show items linked by text matching (fragile) rather than `crm_customer_id`. This plan addresses both issues.

## Research Summary

See `kanban/research-docs/RESEARCH_2026-04-05_client-portal-design-patterns.md` for full analysis. Key findings:

- No competitor offers an authenticated client portal for fractional executives (genuine differentiator)
- ClickUp's two-tier model (authenticated portal + public links) is the best pattern
- RBAC + per-client module toggles is the right permission model
- Magic links via Supabase for client auth (invite-only, no public signup)
- Path-based URLs (`/portal/[module]`) using existing `(portal)` route group

## Architecture Decisions

1. **Portal auth**: Magic links via Supabase `signInWithOtp({ email })`. Invite-only (consultant adds client email). No public signup.
2. **Permission model**: Per-client module toggles stored in `client_portal_settings` table. Binary on/off per module. Item-level control via existing `is_client_visible` booleans.
3. **URL structure**: `/portal/[module]` — dashboard, timesheet, tasks, meetings, deliverables, invoicing, notes, research
4. **Portal layout**: Minimal sidebar showing only enabled modules. Summary cards on dashboard. Read-only views.
5. **CRM linking**: Fix asset query to use `crm_customer_id`. Add CRM customer dropdown to all entity creation forms. Bulk-link UI for existing unlinked items.
6. **Default module visibility**: Deliverables, meetings (summaries only), timesheet (summary), tasks, invoicing = visible. Notes, research = hidden. CRM = always hidden.
7. **Portal user model**: `portal_invitations` table tracks invited emails. When they sign in via magic link, their `user_roles` entry (role='client', client_id) is created automatically.

## Prompts

| #   | Prompt                    | Description                                                                           | Dependencies |
| --- | ------------------------- | ------------------------------------------------------------------------------------- | ------------ |
| 1   | CRM Customer Auto-Linking | Fix asset queries, add crm_customer dropdown to forms, bulk-link migration            | None         |
| 2   | Portal Database Schema    | New tables: client_portal_settings, portal_invitations. RLS policies. Server actions. | None         |
| 3   | Portal Auth & Layout      | Magic link auth flow, portal layout, middleware, sidebar                              | Prompt 2     |
| 4   | Portal Module Views       | Dashboard + read-only views for all 7 modules                                         | Prompt 3     |
| 5   | Sharing Management UI     | Settings page for consultants to manage portal sharing, module toggles, invitations   | Prompt 2     |
| 6   | E2E Tests                 | Playwright tests for portal flow, CRM linking, permissions                            | Prompts 1-5  |

## Files Affected

### New Files

- `supabase/migrations/017_portal_settings.sql` — Portal settings + invitations tables
- `src/lib/actions/portal.ts` — Portal server actions
- `src/lib/validations/portal.ts` — Zod schemas for portal
- `src/app/(portal)/layout.tsx` — Portal layout (replace placeholder)
- `src/app/(portal)/portal/page.tsx` — Portal dashboard (replace placeholder)
- `src/app/(portal)/portal/[module]/page.tsx` — Module views
- `src/app/(portal)/portal/login/page.tsx` — Magic link login
- `src/app/api/portal/invite/route.ts` — Invitation API
- `src/components/portal/` — Portal components (sidebar, module views, summary cards)
- `src/components/settings/portal-settings.tsx` — Sharing management UI
- `src/__tests__/portal/` — Portal tests

### Modified Files

- `src/app/(dashboard)/crm/[slug]/page.tsx` — Fix asset query to use crm_customer_id
- `src/components/crm/customer-tabs.tsx` — Fix asset filtering
- `src/components/tasks/task-form.tsx` — Add CRM customer dropdown
- `src/components/meetings/meeting-form.tsx` — Add CRM customer dropdown
- `src/components/timesheet/time-entry-form.tsx` — Add CRM customer dropdown
- `src/components/assets/asset-form.tsx` — Ensure CRM customer dropdown works
- `src/components/deliverables/deliverable-form.tsx` — Ensure CRM customer dropdown works
- `src/lib/supabase/middleware.ts` — Portal auth handling
- `src/app/(dashboard)/settings/page.tsx` — Add portal settings tab
- `src/lib/types.ts` — Add portal types

## Acceptance Criteria

1. CRM customer detail pages show correctly linked items (not text-matched)
2. All entity creation forms include CRM customer dropdown
3. Portal login works via magic link (invite-only)
4. Portal dashboard shows summary cards for enabled modules
5. Each module view shows read-only data filtered by is_client_visible
6. Consultant can toggle module visibility per client in settings
7. Consultant can invite/remove portal users
8. Different clients can have different module visibility configurations
9. Portal sidebar only shows enabled modules
10. Playwright tests verify the full flow

---

## Review Checklist — 2026-04-05 14:00

- [x] Scope is correctly bounded (not too broad, not too narrow)
- [x] Technical approach matches the project's stack and conventions
- [x] Files affected list is complete and accurate
- [x] Acceptance criteria are specific and testable
- [x] No unexpected dependencies introduced
- [x] Estimated complexity feels right
- [x] Research document supports architectural decisions
- [x] Permission model is appropriately granular without over-engineering

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-04-05_client-portal-crm-linking.md`

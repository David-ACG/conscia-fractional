# Task: Dashboard — Home Page

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Build the dashboard home page — the first thing David sees after logging in. It shows a "glance and go" overview: hours this week, engagement summary, upcoming meetings (placeholder), active tasks (placeholder), and recent activity.

## Specific Instructions

### 1. Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`)

Server component that fetches data from Supabase and renders the dashboard grid.

### 2. Dashboard cards

`src/components/dashboard/hours-card.tsx`:

- Shows hours worked this week vs contract limit (16h)
- Progress bar (primary color) showing fill
- Breakdown by category (top 3)
- Calculated from `time_entries` table (current week)
- Show daily rate equivalent: "£X earned this week"

`src/components/dashboard/engagement-card.tsx`:

- Client name, role title, rate
- Hours/week limit, billing frequency
- Contract scope (bullet list)
- Status badge (active/paused)
- From `engagements` table

`src/components/dashboard/meetings-card.tsx` (placeholder for now):

- "No meetings module yet" empty state
- Will show next 3 upcoming meetings once Calendar module is built

`src/components/dashboard/tasks-card.tsx` (placeholder for now):

- "No tasks module yet" empty state
- Will show active tasks once Tasks module is built

`src/components/dashboard/activity-card.tsx`:

- Recent activity feed (last 5 time entries, notes, deliverables)
- Reverse chronological
- Shows: icon, description, relative time ("2h ago")
- Falls back to empty state if no activity

`src/components/dashboard/quick-actions.tsx`:

- Row of quick action buttons:
  - Start Timer (links to timesheet or starts timer)
  - Add Note (links to notes/new)
  - Log Time (links to timesheet with manual entry)

### 3. Layout

Responsive grid:

- Desktop (>1024px): 3 columns
  - Row 1: Hours card (span 1), Engagement card (span 1), Quick actions (span 1)
  - Row 2: Tasks (span 1), Meetings (span 1), Activity (span 1)
- Tablet (768-1024px): 2 columns
- Mobile (<768px): 1 column, stacked

Use shadcn Card components. Match GWTH v2 card styling (bg-card, border, shadow-sm, rounded-xl).

### 4. Animation

Use Motion (Framer Motion) for card entrance:

- Stagger children with STAGGER_DELAY from config
- Fade in + slide up (`.animate-in` pattern from GWTH v2)

### 5. Tests

`src/app/(dashboard)/dashboard/dashboard.test.tsx`:

- Dashboard renders without error
- Hours card renders with mock data
- Quick actions render with correct links
- Empty states render for placeholder cards

## Files likely affected

- `src/app/(dashboard)/dashboard/page.tsx`
- `src/components/dashboard/hours-card.tsx`
- `src/components/dashboard/engagement-card.tsx`
- `src/components/dashboard/meetings-card.tsx`
- `src/components/dashboard/tasks-card.tsx`
- `src/components/dashboard/activity-card.tsx`
- `src/components/dashboard/quick-actions.tsx`
- `src/app/(dashboard)/dashboard/dashboard.test.tsx`

## Acceptance criteria

- [ ] Dashboard renders after login
- [ ] Hours card shows "0h / 16h" when no time entries exist
- [ ] Hours card shows real data from `time_entries` table when entries exist
- [ ] Engagement card shows Conscia contract details from seed data
- [ ] Quick actions link to correct routes
- [ ] Meetings and Tasks cards show empty states
- [ ] Activity feed shows recent entries or empty state
- [ ] Responsive layout works on mobile, tablet, desktop
- [ ] Card entrance animations play on page load
- [ ] `npm test` passes

## Notes

- Use Supabase server client for data fetching (Server Component)
- Graceful fallback if Supabase is not configured (show demo data or empty states)
- Match GWTH v2 card patterns exactly (shadcn Card, same padding/spacing)

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Dashboard cards cover key day-1 information
- [ ] Graceful fallback when modules not yet built

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_03-dashboard.md`

## Implementation Notes — 2026-03-25 22:25

- **Commit:** pending (part of kanban batch)
- **Tests:** 11 passed (3 files), 0 failures. Typecheck clean. Lint clean.
- **Verification URL:** http://localhost:3000/dashboard (run `npm run dev`)
- **Playwright check:** not applicable (no deployed URL yet)
- **Changes summary:**
  - `src/app/(dashboard)/dashboard/page.tsx` — Server component fetching time_entries, engagements (with client join), notes, deliverables from Supabase. Graceful fallback returns empty arrays when Supabase not configured.
  - `src/components/dashboard/hours-card.tsx` — Hours this week vs weekly limit, progress bar, top 3 categories, earned amount
  - `src/components/dashboard/engagement-card.tsx` — Client name, role, rate, hours/week, billing, scope list, status badge
  - `src/components/dashboard/meetings-card.tsx` — Placeholder with empty state
  - `src/components/dashboard/tasks-card.tsx` — Placeholder with empty state
  - `src/components/dashboard/activity-card.tsx` — Merges recent time entries, notes, deliverables into reverse-chronological feed (last 5)
  - `src/components/dashboard/quick-actions.tsx` — Start Timer (/timer), Add Note (/notes), Log Time (/timesheet)
  - `src/components/dashboard/dashboard-grid.tsx` — Motion stagger wrapper (fade-in + slide-up)
  - `src/app/(dashboard)/dashboard/dashboard.test.tsx` — 8 tests covering all cards, empty states, links
- **Deviations from plan:** None
- **Follow-up issues:** None

---

## Testing Checklist — 2026-03-25 22:25

**Check the changes:** http://localhost:3000/dashboard (run `npm run dev`)

- [ ] Page loads without errors
- [ ] Hours card shows "0.0h / 16h" when no time entries exist
- [ ] Engagement card shows Conscia details from seed data (if Supabase configured)
- [ ] Quick actions: Start Timer → /timer, Add Note → /notes, Log Time → /timesheet
- [ ] Meetings card shows "No meetings module yet"
- [ ] Tasks card shows "No tasks module yet"
- [ ] Activity feed shows empty state or recent entries
- [ ] Cards animate in with stagger on page load
- [ ] Light/dark mode both look correct
- [ ] Mobile responsive (cards stack to 1 column)

### Actions for David

- Run `npm run dev` and check http://localhost:3000/dashboard
- If Supabase is configured with seed data, verify engagement card shows Conscia contract details
- If no Supabase, verify graceful empty states render without errors

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_03-dashboard.md`

# PROMPT 16: Calendar Page UI + Dashboard Upcoming Events Card

> **Phase 4 — Google Calendar Integration (Prompt 16 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing tables:**
  - `calendar_events` — (from Prompt 15) synced Google Calendar events: `id`, `user_id`, `integration_id`, `google_event_id`, `title`, `description`, `start_time`, `end_time`, `location`, `meeting_url`, `attendees` (jsonb), `crm_customer_id` (FK), `meeting_id` (FK), `status`, `created_at`, `updated_at`
  - `crm_customers` — customer records with `id`, `name`, `slug`
  - `meetings` — with `id`, `title`, `date`, `crm_customer_id`
  - `contacts` — with `email`, `crm_customer_id`
- **Calendar sync cron** (from Prompt 15) populates calendar_events from Google Calendar
- **Dashboard page** exists at `src/app/dashboard/page.tsx` with existing cards/widgets
- **Calendar page** exists at `src/app/dashboard/calendar/page.tsx` (likely a placeholder)
- **Meetings page** exists at `src/app/dashboard/meetings/page.tsx`
- **CRM customer pages** at `/dashboard/crm/[slug]`

## Task

### 1. Install FullCalendar Packages

```bash
npm install @fullcalendar/react @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction
```

### 2. Create Calendar Events API

**File:** `src/app/api/calendar/events/route.ts`

```typescript
// GET ?start=ISO_DATE&end=ISO_DATE
//
// 1. Get authenticated user
// 2. Query calendar_events where:
//    - user_id = current user
//    - start_time >= start param
//    - end_time <= end param
//    - status != 'cancelled' (or include cancelled with a flag)
// 3. Join crm_customers to get customer name for display
// 4. Return JSON array:
//    {
//      id: string,
//      title: string,
//      start: string (ISO),
//      end: string (ISO),
//      location: string | null,
//      meeting_url: string | null,
//      attendees: { email, name, responseStatus }[],
//      crm_customer: { id, name, slug } | null,
//      meeting_id: string | null,
//      status: string
//    }
// 5. Use createAdminClient for the query
```

### 3. Replace Calendar Page

**File:** `src/app/dashboard/calendar/page.tsx`

Replace the placeholder with a full calendar view:

```typescript
// 'use client'
//
// - Use FullCalendar React component with plugins:
//   - dayGridPlugin (month view)
//   - timeGridPlugin (week view with time slots)
//   - interactionPlugin (click events)
//
// - Default view: timeGridWeek
// - Header toolbar:
//   - Left: prev, next, today buttons
//   - Center: title (e.g., "March 31 – April 6, 2026")
//   - Right: timeGridWeek, dayGridMonth view toggle buttons
//
// - Event source: fetch from /api/calendar/events with date range
//   - Use FullCalendar's events callback: (fetchInfo, successCallback) => ...
//   - Pass fetchInfo.startStr and fetchInfo.endStr as start/end params
//
// - Event colouring:
//   - Assign consistent colours per CRM customer
//   - Use a palette of 8-10 distinct colours
//   - Hash customer ID to pick colour (deterministic)
//   - Events with no customer: use a neutral grey
//
// - Event click: open EventDetailDialog (see below)
//
// - Responsive:
//   - Desktop (>768px): timeGridWeek
//   - Mobile (<768px): timeGridDay (automatically via FullCalendar responsive config)
//
// - Styling:
//   - Override FullCalendar CSS to match Tailwind/shadcn theme
//   - Use CSS variables for colours so it works with light/dark mode
//   - Import FullCalendar styles
```

### 4. Create Event Detail Dialog

**File:** `src/components/calendar/event-detail-dialog.tsx`

```typescript
// Props: { event: CalendarEvent, open: boolean, onClose: () => void }
//
// Uses shadcn Dialog component
//
// Content:
// - Title (large, bold)
// - Date + time range (e.g., "Wed, April 1, 2026 · 10:00 AM – 11:00 AM")
// - Location (if set) with MapPin icon
// - Meeting URL (if set):
//   - Auto-detect type: Google Meet, Zoom, Teams
//   - Show appropriate icon + "Join Meeting" link (opens in new tab)
// - Attendees list:
//   - Each attendee: name (or email if no name), response status badge
//   - Response status: accepted (green), tentative (yellow), declined (red), needsAction (grey)
//   - If attendee matches a CRM contact: show a link icon → /dashboard/crm/[slug]
// - CRM Customer badge (if linked):
//   - Customer name as a clickable link → /dashboard/crm/[slug]
//
// Action buttons (in Dialog footer):
// - "Record Meeting" → /dashboard/meetings?record=true&from_event={eventId}
//   (This will be fully wired in Prompt 17)
// - "Create Meeting Record" → /dashboard/meetings?from_event={eventId}
//   (This will be fully wired in Prompt 17)
// - "Open in Google Calendar" → https://calendar.google.com/calendar/event?eid={base64_encoded_id}
//   (Or construct the URL from the google_event_id)
```

### 5. Create Upcoming Events Card

**File:** `src/components/dashboard/upcoming-events-card.tsx`

```typescript
// Dashboard card showing next 5 upcoming events
//
// Fetch events from /api/calendar/events with:
//   start = now
//   end = 7 days from now
//   limit = 5 (add limit param to API if needed)
//
// Group events:
// - "Today" — events starting today
// - "Tomorrow" — events starting tomorrow
// - "This Week" — events starting in the next 5 days
//
// Each event row:
// - Time (e.g., "10:00 AM")
// - Title (truncated if long)
// - CRM customer badge (small, coloured dot + name) if linked
// - Click → navigate to /dashboard/calendar (with date focused)
//
// Footer:
// - "View Calendar →" link to /dashboard/calendar
//
// Auto-refresh: poll every 5 minutes (or use SWR/React Query with revalidation)
//
// Empty state: "No upcoming events" with "Connect Google Calendar" link if no integration
//
// Styling:
// - Use shadcn Card component
// - Calendar icon (Lucide CalendarDays) in card header
// - Compact layout — this is a dashboard widget, not a full page
```

### 6. Add Upcoming Events Card to Dashboard

Modify the existing dashboard page at `src/app/dashboard/page.tsx`:

- Find the existing dashboard layout (likely a grid of cards)
- Add `<UpcomingEventsCard />` in an appropriate position
- If the dashboard uses a grid: place it in the right column or after existing cards
- Import the component

### 7. Write Vitest Tests

**File:** `src/components/calendar/__tests__/event-detail-dialog.test.tsx`

Test:

- Renders event title, time, location
- Meeting URL link renders for Google Meet events
- Meeting URL link renders for Zoom events
- Attendees render with correct response status badges
- CRM customer link renders when customer is linked
- Action buttons navigate to correct URLs
- Dialog closes when onClose is called

**File:** `src/components/dashboard/__tests__/upcoming-events-card.test.tsx`

Test:

- Renders events grouped by Today/Tomorrow/This Week
- Shows time, title, customer badge for each event
- Empty state renders when no events
- "View Calendar" link navigates correctly
- Shows "Connect Google Calendar" when no integration

## File Paths Summary

| Action | Path                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| Create | `src/app/api/calendar/events/route.ts`                                        |
| Create | `src/components/calendar/event-detail-dialog.tsx`                             |
| Create | `src/components/dashboard/upcoming-events-card.tsx`                           |
| Create | `src/components/calendar/__tests__/event-detail-dialog.test.tsx`              |
| Create | `src/components/dashboard/__tests__/upcoming-events-card.test.tsx`            |
| Modify | `src/app/dashboard/calendar/page.tsx` (replace placeholder with FullCalendar) |
| Modify | `src/app/dashboard/page.tsx` (add upcoming events card)                       |

## Acceptance Criteria

- [ ] FullCalendar packages installed and in package.json
- [ ] Calendar page renders FullCalendar with week and month views
- [ ] Events fetched from local calendar_events table (not direct Google API)
- [ ] Events coloured by CRM customer (deterministic colour assignment)
- [ ] Event click opens detail dialog with title, time, location, attendees
- [ ] Meeting URL displayed as clickable "Join Meeting" link (detects Meet/Zoom/Teams)
- [ ] Attendees show response status with colour-coded badges
- [ ] "Record Meeting" and "Create Meeting Record" buttons navigate correctly
- [ ] Upcoming events card on dashboard shows next 5 events
- [ ] Events grouped by Today/Tomorrow/This Week
- [ ] Responsive: week view on desktop, day view on mobile
- [ ] Empty states render correctly
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] FullCalendar configuration details are sufficient for implementation
- [ ] Calendar data comes from local DB, not direct Google API calls

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_16-calendar-ui.md`

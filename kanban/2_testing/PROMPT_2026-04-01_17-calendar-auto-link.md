# PROMPT 17: Auto-Link Calendar Events to Customers + Pre-Fill Meeting Forms

> **Phase 4 — Google Calendar Integration (Prompt 17 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing tables:**
  - `calendar_events` — (from Prompt 15) synced events: `id`, `user_id`, `integration_id`, `google_event_id`, `title`, `description`, `start_time`, `end_time`, `location`, `meeting_url`, `attendees` (jsonb: `[{ email, name, responseStatus }]`), `crm_customer_id` (FK, nullable), `meeting_id` (FK, nullable), `status`, `created_at`, `updated_at`
  - `crm_customers` — customer records with `id`, `name`, `slug`
  - `contacts` — contact records with `id`, `email`, `name`, `crm_customer_id`
  - `meetings` — with `id`, `title`, `date`, `duration`, `crm_customer_id`, `participants` (jsonb), `transcript`, `summary`
- **Calendar sync cron** (from Prompt 15) at `/api/cron/calendar-sync` syncs events and already calls `matchAttendeesToCustomer` for basic matching
- **Calendar page** (from Prompt 16) with FullCalendar, event detail dialog with "Record Meeting" and "Create Meeting Record" buttons
- **Meetings page** at `src/app/dashboard/meetings/page.tsx` with meeting creation form
- **Meeting recording UI** exists (from Prompt 04) — likely a recording component or page
- **Google Calendar service** at `src/lib/services/google-calendar-service.ts` with `syncEvents`, `extractMeetingUrl`, `matchAttendeesToCustomer`

## Task

### 1. Create Auto-Linking Service

**File:** `src/lib/services/calendar-link-service.ts`

```typescript
// linkEventToCustomer(eventId: string) → Promise<string | null>
//   1. Fetch calendar event by ID (using createAdminClient)
//   2. Get event.attendees array
//   3. For each attendee email:
//      - Query contacts table: SELECT crm_customer_id FROM contacts WHERE email = attendee.email
//      - Collect all matching crm_customer_ids (deduplicate)
//   4. Resolution logic:
//      - If 0 matches → return null (no link)
//      - If 1 unique customer → use that customer
//      - If multiple customers (multi-stakeholder meeting):
//        - Query meetings table: SELECT crm_customer_id, MAX(date) as last_meeting
//          FROM meetings WHERE crm_customer_id IN (matched_ids)
//          GROUP BY crm_customer_id ORDER BY last_meeting DESC LIMIT 1
//        - Use the customer with the most recent meeting
//        - If no meetings exist for any matched customer, use the first match
//   5. Update calendar_events.crm_customer_id = resolved customer ID
//   6. Return the crm_customer_id

// batchLinkEvents(eventIds: string[]) → Promise<void>
//   - Call linkEventToCustomer for each event ID
//   - Use Promise.allSettled (don't let one failure block others)
//   - Log results: { linked: number, skipped: number, errors: number }

// relinkIfAttendeesChanged(eventId: string, previousAttendees: any[], newAttendees: any[]) → Promise<void>
//   - Compare attendee email lists
//   - If different, call linkEventToCustomer to re-evaluate
//   - If same, skip (no work needed)
```

### 2. Integrate Auto-Linking into Calendar Sync Cron

**File:** Modify `src/app/api/cron/calendar-sync/route.ts`

After events are upserted in the sync loop:

```typescript
// For each synced event:
// 1. If it's a new event (inserted, not updated): add to linkBatch
// 2. If it's an updated event AND attendees changed: add to linkBatch
// 3. After all events processed: call batchLinkEvents(linkBatch)
//
// The existing matchAttendeesToCustomer in the sync already does basic matching.
// The auto-linking service provides more robust matching (multi-customer resolution).
// Replace the inline matching with a call to linkEventToCustomer for consistency.
```

### 3. Create Meeting Pre-Fill Logic

**File:** `src/app/api/calendar/events/[id]/route.ts`

```typescript
// GET /api/calendar/events/:id
// 1. Verify authenticated user owns the event
// 2. Return full event details including attendees, crm_customer, meeting_url
// 3. Used by the meeting form to pre-fill data
```

**Modify meetings page** (or meeting form component):

When the URL contains `?from_event=<event_id>`:

```typescript
// 1. Parse from_event query parameter
// 2. Fetch calendar event from /api/calendar/events/{event_id}
// 3. Pre-fill the meeting creation form:
//    - Title: event.title
//    - Date: event.start_time (formatted for date input)
//    - Duration: calculated from (end_time - start_time) in minutes
//      - Round up to nearest 15 minutes per project convention
//    - CRM Customer: event.crm_customer_id (pre-select in dropdown)
//    - Participants: event.attendees mapped to:
//      - Match each email against contacts table
//      - If contact found: use contact record
//      - If not found: create a temporary participant entry with just the email/name
//    - Meeting URL: event.meeting_url (display for reference)
//
// 4. Show a banner: "Pre-filled from calendar event: {title}"
//    - With a "Clear" button to reset the form
```

### 4. Handle "Record Meeting" from Calendar

When the URL contains `?record=true&from_event=<event_id>`:

```typescript
// 1. Parse both query parameters
// 2. Fetch calendar event
// 3. Open the recording UI (from Prompt 04) with pre-filled metadata:
//    - Same pre-fill as above (title, date, duration, customer, participants)
//    - Recording UI should accept these as initial values
// 4. After recording completes and meeting is saved:
//    - Update calendar_events.meeting_id = new meeting.id
//    - This links the calendar event to the meeting record
//    - Use createAdminClient for the update
```

**File:** Create or modify `src/lib/services/calendar-meeting-service.ts`

```typescript
// linkMeetingToEvent(meetingId: string, eventId: string) → Promise<void>
//   - Update calendar_events SET meeting_id = meetingId WHERE id = eventId
//   - Uses createAdminClient

// getEventForPreFill(eventId: string) → Promise<MeetingPreFillData>
//   - Fetch event
//   - Match attendees to contacts
//   - Calculate duration (rounded to 15 min)
//   - Return structured pre-fill data:
//     {
//       title: string,
//       date: string,
//       duration: number, // minutes
//       crm_customer_id: string | null,
//       participants: { contact_id?: string, email: string, name: string }[],
//       meeting_url: string | null,
//       source_event_id: string
//     }
```

### 5. Write Vitest Tests

**File:** `src/lib/services/__tests__/calendar-link-service.test.ts`

Test:

- `linkEventToCustomer` matches single attendee to customer
- `linkEventToCustomer` resolves multiple customers using most recent meeting
- `linkEventToCustomer` falls back to first match when no meetings exist
- `linkEventToCustomer` returns null when no attendees match contacts
- `linkEventToCustomer` ignores the user's own email
- `batchLinkEvents` links multiple events, handles partial failures
- `relinkIfAttendeesChanged` re-links when attendees differ
- `relinkIfAttendeesChanged` skips when attendees are the same

**File:** `src/lib/services/__tests__/calendar-meeting-service.test.ts`

Test:

- `getEventForPreFill` returns correct pre-fill data
- Duration is calculated correctly and rounded to 15 minutes
- Attendees matched to contacts where possible
- Unmatched attendees included with email/name only
- `linkMeetingToEvent` updates calendar_events.meeting_id

**File:** Test for meeting form pre-fill (component test):

- Form pre-fills from calendar event data
- "Pre-filled from calendar" banner shows
- "Clear" button resets the form
- Pre-filled customer dropdown selects correctly

## File Paths Summary

| Action | Path                                                                         |
| ------ | ---------------------------------------------------------------------------- |
| Create | `src/lib/services/calendar-link-service.ts`                                  |
| Create | `src/lib/services/calendar-meeting-service.ts`                               |
| Create | `src/app/api/calendar/events/[id]/route.ts`                                  |
| Create | `src/lib/services/__tests__/calendar-link-service.test.ts`                   |
| Create | `src/lib/services/__tests__/calendar-meeting-service.test.ts`                |
| Modify | `src/app/api/cron/calendar-sync/route.ts` (integrate batchLinkEvents)        |
| Modify | Meetings page/form component (add pre-fill from ?from_event param)           |
| Modify | Meeting recording component (accept pre-fill data, link to event after save) |

## Acceptance Criteria

- [ ] Auto-linking matches attendee emails to CRM customers via contacts table
- [ ] Multiple customer resolution picks the one with the most recent meeting
- [ ] Falls back to first match when no prior meetings exist
- [ ] `batchLinkEvents` runs after calendar sync for new/updated events
- [ ] Re-linking only triggers when attendees actually changed
- [ ] Meeting form pre-fills title, date, duration, customer, participants from calendar event
- [ ] Duration rounded up to nearest 15 minutes
- [ ] "Pre-filled from calendar" banner shows with clear button
- [ ] "Record Meeting" opens recording UI with pre-filled metadata
- [ ] After meeting is saved, `calendar_events.meeting_id` is set
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Multi-customer resolution logic is clearly specified
- [ ] Pre-fill data flow (calendar event → meeting form) is fully described

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_17-calendar-auto-link.md`

---

## Implementation Notes — 2026-04-02 11:22

- **Commit:** 08ef6d6 feat(prompt-17): auto-link calendar events to customers + meeting pre-fill
- **Tests:** 575 passed (59 test files) — 28 new tests added
- **Verification URL:** http://localhost:3002/meetings?from_event=<event-id>
- **Changes summary:**
  - `src/lib/services/calendar-link-service.ts` — new: linkEventToCustomer, batchLinkEvents, relinkIfAttendeesChanged
  - `src/lib/services/calendar-meeting-service.ts` — new: linkMeetingToEvent, getEventForPreFill (duration rounded up to 15 min)
  - `src/lib/types.ts` — added MeetingPreFillData, MeetingPreFillParticipant interfaces
  - `src/app/api/calendar/events/[id]/route.ts` — new: GET endpoint with user ownership check
  - `src/lib/actions/calendar.ts` — new: linkMeetingToEventAction server action
  - `src/app/api/cron/calendar-sync/route.ts` — replaced inline matchAttendeesToCustomer with batchLinkEvents
  - `src/app/(dashboard)/meetings/page.tsx` — reads ?from_event & ?record searchParams, fetches prefillData server-side
  - `src/components/meetings/meeting-list.tsx` — accepts prefillData/recordMode, auto-opens form or recording sheet
  - `src/components/meetings/meeting-form.tsx` — pre-fill banner with Clear button, links meeting to event on create
  - `src/components/meetings/recording-container.tsx` — accepts prefillData, passes crm_customer_id, links after save
  - `src/lib/actions/recording.ts` — reads optional crm_customer_id from FormData
- **Deviations from plan:** batchLinkEvents runs for all synced events (not just new/changed) for simplicity; attendee-changed detection via relinkIfAttendeesChanged is available but cron uses batch-all approach
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-02 11:22

**Check the changes:** http://localhost:3002/calendar → click an event → "Create Meeting Record" or "Record Meeting"

- [ ] Page loads without errors
- [ ] Clicking "Create Meeting Record" on a calendar event navigates to /meetings?from_event=<id>
- [ ] Meeting form opens automatically with pre-filled title, date, duration, customer, attendees
- [ ] "Pre-filled from calendar event: <title>" banner appears with Clear button
- [ ] Clear button dismisses the banner and resets the form
- [ ] Creating the meeting links it back (calendar_events.meeting_id is set)
- [ ] Clicking "Record Meeting" opens the recording sheet with pre-fill metadata
- [ ] After recording, meeting is linked to the calendar event
- [ ] Calendar sync now auto-links new events via contacts.crm_customer_id
- [ ] No console errors

### Actions for David

Check the URL above and tick the boxes. To verify auto-linking, trigger a calendar sync (`curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3002/api/cron/calendar-sync`) and check that calendar_events.crm_customer_id is populated for events with known attendees.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_17-calendar-auto-link.md`

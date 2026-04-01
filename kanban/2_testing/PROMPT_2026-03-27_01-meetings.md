# PROMPT: Meetings Module

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. The Meetings page is a placeholder. The meetings table already exists in Supabase with RLS. The client switcher provides `getActiveClientId()` from `@/lib/actions/clients`. Meetings are a log of meetings David has attended — with markdown notes, optional transcript, optional CRM customer link, and a "Log to Timesheet" button.

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, react-hook-form, zod

## Database Schema (already exists — DO NOT create migrations)

### meetings

```
id uuid PK, client_id uuid FK, crm_customer_id uuid FK nullable,
title text NOT NULL, meeting_date timestamptz, duration_minutes integer,
attendees jsonb DEFAULT '[]', transcript text, summary text,
action_items jsonb DEFAULT '[]', recording_url text, platform text,
is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Platform values: `zoom`, `teams`, `meet`, or null

### MeetingAttendee type (already in src/lib/types.ts)

```typescript
export interface MeetingAttendee {
  name: string;
  email?: string;
  role?: string;
}
```

### Meeting type (already in src/lib/types.ts)

Already defined with all fields matching the schema. DO NOT recreate.

## What to Build

### 1. Meetings Server Actions (`src/lib/actions/meetings.ts`)

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/actions/clients";

// Zod schema for meeting:
// title: string min 1, meeting_date: string (ISO), duration_minutes: number optional,
// crm_customer_id: string optional, attendees: array of { name, email?, role? },
// summary: string optional, transcript: string optional,
// recording_url: string optional, platform: enum optional,
// is_client_visible: boolean

export async function createMeeting(data);
// Parse with zod, get clientId from getActiveClientId()
// Insert into meetings table
// revalidatePath("/meetings")
// Return { success: true, meetingId } or { error: string }

export async function updateMeeting(id, data);

export async function deleteMeeting(id);

export async function logMeetingToTimesheet(meetingId: string);
// 1. Fetch the meeting (title, duration_minutes, meeting_date, client_id, crm_customer_id)
// 2. Create a time_entry:
//    - client_id: from meeting
//    - crm_customer_id: from meeting
//    - category: "Meeting"
//    - description: meeting title
//    - started_at: meeting_date
//    - stopped_at: meeting_date + duration_minutes
//    - duration_minutes: from meeting
//    - is_manual: true
//    - meeting_id: meetingId (links the time entry back to the meeting)
//    - is_billable: true
// 3. revalidatePath("/meetings")
// 4. revalidatePath("/timesheet")
// 5. Return { success: true } or { error }
```

### 2. Meetings Page (`src/app/(dashboard)/meetings/page.tsx`)

Replace the placeholder. Async server component:

```typescript
import { createClient } from "@/lib/supabase/server"
import { getActiveClientId } from "@/lib/actions/clients"
import { MeetingList } from "@/components/meetings/meeting-list"
import type { Meeting, CrmCustomer } from "@/lib/types"

async function getMeetingsData() {
  const clientId = await getActiveClientId()
  if (!clientId) return { meetings: [], customers: [] }

  const supabase = await createClient()
  if (!supabase) return { meetings: [], customers: [] }

  const [meetingsRes, customersRes] = await Promise.all([
    supabase
      .from("meetings")
      .select("*, crm_customer:crm_customers(name)")
      .eq("client_id", clientId)
      .order("meeting_date", { ascending: false }),
    supabase
      .from("crm_customers")
      .select("id, name")
      .eq("client_id", clientId)
      .order("name"),
  ])

  return {
    meetings: (meetingsRes.data ?? []) as (Meeting & { crm_customer: { name: string } | null })[],
    customers: (customersRes.data ?? []) as Pick<CrmCustomer, "id" | "name">[],
  }
}

export default async function MeetingsPage() {
  const { meetings, customers } = await getMeetingsData()
  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold">Meetings</h1>
      <p className="text-muted-foreground">Log meetings, notes, and transcripts.</p>
      <div className="mt-6">
        <MeetingList meetings={meetings} customers={customers} />
      </div>
    </div>
  )
}
```

### 3. Meeting List Component (`src/components/meetings/meeting-list.tsx`)

"use client" component:

**Toolbar:**

- Search input (filters title, summary)
- Platform filter: toggle badges (All / Zoom / Teams / Meet)
- "Add Meeting" button

**Table view** (meetings need dates and durations visible):

| Date | Title | Customer | Platform | Duration | Attendees | Timesheet | Actions |
| ---- | ----- | -------- | -------- | -------- | --------- | --------- | ------- |

- Date: formatted date+time (e.g., "27 Mar 2026, 10:00")
- Title: bold, clickable to expand/edit
- Customer: CRM customer name or "—" (for admin/planning meetings)
- Platform: icon badge (Zoom blue, Teams purple, Meet green, null gray)
- Duration: e.g. "45m" or "1h 30m"
- Attendees: count badge (e.g. "4 people"), tooltip showing names on hover
- Timesheet: "Logged" badge (green) if a time_entry exists with this meeting_id, or "Log" button (calls logMeetingToTimesheet)
- Actions: dropdown with Edit, Delete

Use shadcn Table component.

**Empty state:** "No meetings logged yet. Record your meetings and keep notes."

### 4. Meeting Form (`src/components/meetings/meeting-form.tsx`)

Dialog form (larger — `max-w-2xl`):

**Fields:**

- title (required)
- meeting_date (datetime-local input)
- duration_minutes (number input, in minutes)
- platform (select: Zoom / Teams / Meet / Other)
- crm_customer_id (select from customers list — optional, with "None / Admin" option)
- attendees (dynamic list — add/remove attendees, each with name + optional email + optional role)
- summary (textarea, 6 rows — "Meeting summary or key points")
- transcript (textarea, 10 rows — "Paste transcript or meeting notes (markdown supported)")
- recording_url (text input — link to recording)
- is_client_visible (checkbox)

**Attendees input pattern:**

- Show a list of attendee rows, each with: name input, email input (smaller), role input (smaller), remove button
- "Add Attendee" button below the list
- Store as JSON array: `[{ name: "Sana", email: "sana@conscia.ai", role: "CEO" }]`

Create/edit/delete pattern. Toast feedback.

### 5. Meeting Expand/Detail View (`src/components/meetings/meeting-detail.tsx`)

When clicking a meeting row, show a Sheet (slides from right) with:

- Meeting title + date + duration
- Platform badge
- Customer name (if linked)
- Attendees list (name, email, role)
- Summary section (rendered as markdown if possible, or plain text)
- Transcript section (scrollable, could be long)
- Action items list (if any)
- Recording link (if any)
- "Log to Timesheet" button (if not already logged)
- Edit button (opens form)

Use a Sheet component (from shadcn) — this is supplementary detail.

## Platform Icons/Colors

```
zoom: Video icon, blue badge
teams: Monitor icon, purple badge
meet: Video icon, green badge
null/other: Calendar icon, gray badge
```

## Duration Formatting Helper

Create a small helper (in the meeting-list file or a shared util):

```typescript
function formatDuration(minutes: number | null): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

## Acceptance Criteria

- [ ] Meetings page shows table of meetings filtered by selected client
- [ ] Search and platform filter work
- [ ] Create new meeting via dialog form with all fields
- [ ] Attendees can be added/removed dynamically in the form
- [ ] Edit existing meeting
- [ ] Delete meeting with confirmation
- [ ] "Log to Timesheet" creates a time entry linked to the meeting
- [ ] "Logged" badge shows when a time entry already exists for the meeting
- [ ] Meeting detail Sheet shows full info including transcript/summary
- [ ] CRM customer is optional (admin meetings have no customer)
- [ ] Platform badges are color-coded
- [ ] Duration formatted as "Xh Ym"
- [ ] All forms validate with zod
- [ ] Toast feedback on all operations
- [ ] Existing tests pass (`npm test`)
- [ ] New tests: meetings.test.ts

## Test Expectations

`src/lib/actions/__tests__/meetings.test.ts`:

- Test createMeeting with valid data
- Test updateMeeting
- Test deleteMeeting
- Test logMeetingToTimesheet creates a time entry

## Files to Create

- `src/lib/actions/meetings.ts`
- `src/lib/actions/__tests__/meetings.test.ts`
- `src/components/meetings/meeting-list.tsx`
- `src/components/meetings/meeting-form.tsx`
- `src/components/meetings/meeting-detail.tsx`

## Files to Modify

- `src/app/(dashboard)/meetings/page.tsx` — replace placeholder

---

## Review Checklist — 2026-03-27 10:40

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct
- [ ] Acceptance criteria match the plan
- [ ] No scope creep (transcription AI is Phase 4)
- [ ] CRM customer link is optional as specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-27_01-meetings.md`

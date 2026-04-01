# PROMPT 15: Google Calendar Event Sync (Incremental)

> **Phase 4 — Google Calendar Integration (Prompt 15 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing tables:**
  - `integrations` — encrypted token storage (`id`, `user_id`, `provider`, `account_identifier`, `encrypted_token`, `metadata` jsonb, `created_at`, `updated_at`)
  - `crm_customers` — customer records with `id`, `name`, `slug`
  - `contacts` — contact records with `email`, `crm_customer_id`
  - `meetings` — with `id`, `title`, `date`, `crm_customer_id`, `transcript`, `summary`
- **Google OAuth flow** (from Prompt 07) already exists:
  - `googleapis` npm package is installed
  - Google integration stored in integrations table with `provider='google'`
  - OAuth tokens stored encrypted
  - Google auth service exists at `src/lib/services/google-auth-service.ts` (or similar)
  - Scopes currently include Drive access (from earlier prompts)
- **Settings page** at `src/app/dashboard/settings/page.tsx` with Google integration card
- **Environment variables:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` already configured
- **`CRON_SECRET`** environment variable exists for securing cron routes

## Task

### 1. Create Supabase Migration for calendar_events

**File:** `supabase/migrations/<timestamp>_create_calendar_events.sql`

```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  google_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  meeting_url text,                     -- Extracted from hangoutLink / description
  attendees jsonb DEFAULT '[]'::jsonb,  -- [{ email, name, responseStatus }]
  crm_customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  meeting_id uuid REFERENCES meetings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'confirmed',  -- confirmed, tentative, cancelled
  raw_data jsonb,                        -- Full Google event for debugging
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(integration_id, google_event_id)
);

-- Sync token stored per integration in integrations.metadata.calendar_sync_token

-- RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own calendar events"
  ON calendar_events FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own calendar events"
  ON calendar_events FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Indexes for common queries
CREATE INDEX idx_calendar_events_user_start ON calendar_events(user_id, start_time);
CREATE INDEX idx_calendar_events_customer ON calendar_events(crm_customer_id);
CREATE INDEX idx_calendar_events_integration ON calendar_events(integration_id, google_event_id);
```

### 2. Add calendar.readonly Scope to Google OAuth

Modify the Google auth service:

- **Current scopes** likely include Drive scopes. Add `https://www.googleapis.com/auth/calendar.readonly`
- **Incremental auth approach:**
  - Google OAuth supports `include_granted_scopes=true` parameter
  - When user already has a Google connection but no calendar scope:
    - Show "Add Calendar Access" button on Settings page
    - Button triggers OAuth flow with ONLY the calendar scope + `include_granted_scopes=true`
    - Google merges the new scope with existing granted scopes
  - When connecting Google for the first time: include calendar scope in initial request
- **Update the Settings page Google section:**
  - Detect if calendar scope is granted (store granted scopes in `integrations.metadata.scopes` array)
  - If calendar not granted: show "Add Calendar Access" button
  - If calendar granted: show "Calendar connected" indicator

**File to modify:** `src/lib/services/google-auth-service.ts` (or equivalent)

Add:

```typescript
// generateCalendarScopeUrl(state: string) → string
//   - URL with scope: 'https://www.googleapis.com/auth/calendar.readonly'
//   - include_granted_scopes: 'true'
//   - This triggers incremental auth
```

**File to modify:** Google OAuth callback handler

- After token exchange, check granted scopes (from token response)
- Store/update `metadata.scopes` array in integrations table
- If calendar scope is newly granted, trigger initial calendar sync

### 3. Create Calendar Service

**File:** `src/lib/services/google-calendar-service.ts`

```typescript
import { google, calendar_v3 } from "googleapis";

// Types:
// CalendarEvent {
//   google_event_id: string
//   title: string
//   description: string | null
//   start_time: string (ISO)
//   end_time: string (ISO)
//   location: string | null
//   meeting_url: string | null
//   attendees: { email: string, name: string | null, responseStatus: string }[]
//   status: 'confirmed' | 'tentative' | 'cancelled'
// }

// syncEvents(auth: OAuth2Client, syncToken?: string) → { events: CalendarEvent[], nextSyncToken: string }
//   - Use calendar.events.list on 'primary' calendar
//   - If syncToken provided: pass as syncToken parameter (incremental sync)
//   - If no syncToken: full sync with timeMin = 30 days ago, timeMax = 90 days ahead
//   - Handle pagination (nextPageToken)
//   - Handle 410 Gone response: clear syncToken, do full re-sync
//   - Map Google event to CalendarEvent type
//   - Return nextSyncToken for storage

// extractMeetingUrl(event: calendar_v3.Schema$Event) → string | null
//   - Check event.hangoutLink first (Google Meet)
//   - Then search event.description for URLs matching:
//     - Zoom: https://.*zoom.us/j/\d+
//     - Teams: https://teams.microsoft.com/l/meetup-join/.*
//     - Webex: https://.*webex.com/.*
//   - Then check event.location for same patterns
//   - Return first match or null

// matchAttendeesToCustomer(
//   attendees: { email: string }[],
//   userId: string
// ) → Promise<string | null>  // crm_customer_id
//   - Query contacts table for attendee emails
//   - If matches found, return the crm_customer_id
//   - If multiple customers match, return the one with the most recent meeting
//   - Uses createAdminClient for DB query
//   - Exclude the user's own email from matching
```

### 4. Create Sync Cron Route

**File:** `src/app/api/cron/calendar-sync/route.ts`

```typescript
// GET handler (secured with CRON_SECRET)
//
// 1. Verify Authorization header: Bearer ${CRON_SECRET}
//    - Return 401 if missing or invalid
//
// 2. Fetch all integrations where:
//    - provider = 'google'
//    - metadata.scopes array contains 'calendar.readonly' (or similar check)
//
// 3. For each integration:
//    a. Decrypt token, create OAuth2Client
//    b. Handle token refresh if needed (google client does this automatically)
//    c. Get sync token from integrations.metadata.calendar_sync_token (may be null)
//    d. Call syncEvents(auth, syncToken)
//    e. For each event returned:
//       - Extract meeting URL
//       - Match attendees to CRM customer
//       - Upsert into calendar_events:
//         - ON CONFLICT (integration_id, google_event_id) DO UPDATE
//         - Update title, description, times, attendees, status, meeting_url, crm_customer_id
//       - If status = 'cancelled', handle appropriately (keep record but mark cancelled)
//    f. Store nextSyncToken in integrations.metadata.calendar_sync_token
//    g. Store last sync time in integrations.metadata.calendar_last_sync
//
// 4. Return JSON summary: { synced: number, errors: string[] }
//
// Error handling: if one integration fails, log error and continue with next.
// Don't let one user's broken token stop sync for all users.
```

### 5. Write Vitest Tests

**File:** `src/lib/services/__tests__/google-calendar-service.test.ts`

Test:

- `syncEvents` with no sync token does full sync with correct time range
- `syncEvents` with sync token does incremental sync
- `syncEvents` handles 410 Gone by clearing token and retrying
- `syncEvents` handles pagination (multiple pages)
- `extractMeetingUrl` finds Google Meet hangoutLink
- `extractMeetingUrl` finds Zoom URL in description
- `extractMeetingUrl` finds Teams URL in location
- `extractMeetingUrl` returns null when no URL found
- `matchAttendeesToCustomer` matches email to contact's customer
- `matchAttendeesToCustomer` returns most recent meeting customer on multi-match
- `matchAttendeesToCustomer` returns null when no match
- Cron route rejects requests without valid CRON_SECRET

## File Paths Summary

| Action | Path                                                                                 |
| ------ | ------------------------------------------------------------------------------------ |
| Create | `supabase/migrations/<timestamp>_create_calendar_events.sql`                         |
| Create | `src/lib/services/google-calendar-service.ts`                                        |
| Create | `src/app/api/cron/calendar-sync/route.ts`                                            |
| Create | `src/lib/services/__tests__/google-calendar-service.test.ts`                         |
| Modify | `src/lib/services/google-auth-service.ts` (add calendar scope, incremental auth)     |
| Modify | Google OAuth callback (store granted scopes in metadata)                             |
| Modify | `src/app/dashboard/settings/page.tsx` (add Calendar Access button, status indicator) |
| Modify | `.env.local.example` (add CRON_SECRET if not already present)                        |

## Acceptance Criteria

- [ ] Migration creates `calendar_events` table with correct schema, RLS, and indexes
- [ ] Incremental sync with Google sync tokens works (first sync = full, subsequent = delta)
- [ ] Full re-sync triggered on 410 Gone response
- [ ] Meeting URLs extracted from hangoutLink, description, and location
- [ ] Attendees auto-matched to CRM customers via contacts table email lookup
- [ ] Cron route secured with CRON_SECRET
- [ ] Cron handles multiple integrations, one failure doesn't block others
- [ ] Incremental auth: "Add Calendar Access" button grants calendar.readonly scope
- [ ] Granted scopes tracked in integrations.metadata.scopes
- [ ] Sync token and last sync time stored in integrations.metadata
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Google Calendar API specifics (sync tokens, 410 handling) are correctly described
- [ ] Incremental auth flow is properly specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_15-calendar-sync.md`

---

## Implementation Notes — 2026-04-02 00:14

- **Commit:** 089c38c feat(prompt-15): google calendar sync with incremental token support
- **Tests:** 528 passed (54 test files)
- **Verification URL:** http://localhost:3002/dashboard/settings
- **Playwright check:** N/A — no web UI changes beyond settings button (no running server)
- **Changes summary:**
  - `supabase/migrations/012_create_calendar_events.sql` — calendar_events table, RLS, 3 indexes
  - `src/lib/services/google-calendar-service.ts` — syncEvents (full + incremental + 410 recovery + pagination), extractMeetingUrl (Meet/Zoom/Teams/Webex), matchAttendeesToCustomer (contacts → clients → crm_customers)
  - `src/app/api/cron/calendar-sync/route.ts` — GET cron, CRON_SECRET auth, per-integration error isolation, upserts events, stores sync token + last_sync in metadata
  - `src/lib/services/google-auth-service.ts` — added generateCalendarScopeUrl()
  - `src/app/api/auth/google/callback/route.ts` — incremental auth: skip no_refresh_token error if integration already exists
  - `src/app/(dashboard)/settings/google-integrations.tsx` — "Add Calendar Access" button now active, links to /api/auth/google?scopes=calendar.readonly when scope not yet granted
  - `src/app/api/auth/google/__tests__/callback.test.ts` — added admin mock for incremental auth test
  - `src/lib/services/__tests__/google-calendar-service.test.ts` — 12 tests: syncEvents (full/incremental/410/pagination), extractMeetingUrl (4 cases), matchAttendeesToCustomer (4 cases)
  - `src/app/api/cron/calendar-sync/__tests__/route.test.ts` — 5 tests: auth checks, empty sync, success sync, error isolation
- **Deviations from plan:** contacts table uses client_id (not crm_customer_id as prompt assumed) — matchAttendeesToCustomer implemented via contacts → client → meetings → crm_customer lookup
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-02 00:14

**Check the changes:** http://localhost:3002/dashboard/settings

- [ ] Page loads without errors
- [ ] Google-connected accounts show "Add Calendar Access" button if calendar scope not granted
- [ ] "Add Calendar Access" button is hidden for accounts that already have calendar.readonly scope
- [ ] Clicking "Add Calendar Access" triggers Google OAuth flow with calendar.readonly scope
- [ ] After granting calendar access, settings page shows Calendar badge on that account
- [ ] Cron endpoint rejects requests without CRON_SECRET: `curl http://localhost:3002/api/cron/calendar-sync` → 401
- [ ] Cron endpoint returns sync summary: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/calendar-sync` → `{"synced":N,"errors":[]}`

### Actions for David

1. Run `supabase db push` (or apply migration via Supabase dashboard) to create the calendar_events table
2. Check the Settings page at the URL above and tick the boxes
3. Test the "Add Calendar Access" button with a connected Google account
4. Set `CRON_SECRET` in your `.env.local` if not already set, then test the cron endpoint

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_15-calendar-sync.md`

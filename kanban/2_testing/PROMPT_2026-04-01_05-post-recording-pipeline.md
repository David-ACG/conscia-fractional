# PROMPT 05: Post-Recording Pipeline (Connect Recording to Claude Extraction)

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application. It uses Supabase (PostgreSQL with RLS) for auth and database. All server actions use `createAdminClient` from `src/lib/supabase/admin.ts` (service role, bypasses RLS). Testing with Vitest (`npm test`).

Key files:

- Existing transcript parser: `src/lib/transcript-parser.ts` — expects SRT format:
  ```
  HH:MM:SS,mmm --> HH:MM:SS,mmm [Speaker]
  Text content
  (blank line)
  ```
  Exports `parseTranscript(raw: string): TranscriptMetadata` and `TranscriptSegment { startMs, endMs, speaker, text }`
- Existing Claude extraction endpoint: `src/app/api/meetings/process-transcript/route.ts` — `POST` accepts `{ transcript: string, filename?: string }`, calls Claude to extract title, summary, and tasks. Uses `ANTHROPIC_API_KEY` env var.
- Existing meeting actions: `src/lib/actions/meetings.ts` — `createMeeting(data)`, `updateMeeting(id, data)`. Uses `createAdminClient`. Has `roundUpTo15(minutes)` helper for 15-minute billing rounding.
- Meeting type: `src/lib/types.ts` — `Meeting { id, client_id, crm_customer_id, title, meeting_date, duration_minutes, attendees, transcript, summary, action_items, recording_url, platform, is_client_visible, ... }`
- TimeEntry type: `src/lib/types.ts` — `TimeEntry { id, client_id, crm_customer_id, category, description, started_at, stopped_at, duration_minutes, is_manual, meeting_id, is_billable, ... }`
- Transcription types from PROMPT 02: `src/lib/types/transcription.ts` — `TranscriptSegment { text, startMs, endMs, speaker, confidence }`
- Recording container from PROMPT 04: calls `onComplete({ segments, audioBlob, durationSeconds })`
- Active client: `getActiveClientId()` from `src/lib/actions/clients.ts`
- Time entry creation: check existing patterns in `src/lib/actions/` for how time entries are created
- Supabase Storage: use `supabase.storage` API for file uploads

## Task

### 1. Create recording processing service at `src/lib/services/recording-service.ts`

**Methods:**

#### `segmentsToSrt(segments: TranscriptSegment[]): string`

Convert an array of `TranscriptSegment` objects to the SRT format that `transcript-parser.ts` expects:

```
HH:MM:SS,mmm --> HH:MM:SS,mmm [Speaker Name]
Text content of the segment.

HH:MM:SS,mmm --> HH:MM:SS,mmm [Speaker Name]
Next segment text.
```

- Convert `startMs`/`endMs` (milliseconds) to `HH:MM:SS,mmm` format
- Use the `speaker` field as the speaker label in brackets
- Separate blocks with blank lines
- This format MUST match what `parseTranscript()` in `transcript-parser.ts` successfully parses (verify by reading that function's regex)

#### `uploadAudio(audioBlob: Blob, userId: string, meetingId: string): Promise<string>`

- Upload audio blob to Supabase Storage bucket `meeting-recordings`
- Path: `{userId}/{meetingId}/recording.webm`
- Use `createAdminClient()` for the upload (service role to bypass storage RLS)
- Return the public URL or signed URL

#### `processRecording(params: ProcessRecordingParams): Promise<ProcessRecordingResult>`

```typescript
interface ProcessRecordingParams {
  segments: TranscriptSegment[];
  audioBlob: Blob;
  durationSeconds: number;
  userId: string;
  clientId: string;
  crmCustomerId?: string;
}

interface ProcessRecordingResult {
  meetingId: string;
  title: string;
  summary: string;
  tasks: Array<{ title: string; description: string; priority: string }>;
  timeEntryId: string;
  audioUrl: string;
}
```

Steps:

1. Convert segments to SRT format using `segmentsToSrt()`
2. Create the meeting record via `createAdminClient()`:
   - `client_id`: from params
   - `crm_customer_id`: from params if provided
   - `title`: temporary "Processing recording..." (updated after Claude extraction)
   - `meeting_date`: current ISO date
   - `duration_minutes`: `roundUpTo15(Math.ceil(durationSeconds / 60))` — round up to nearest 15 mins
   - `transcript`: the SRT string
   - `attendees`: extract unique speakers from segments as `[{ name: speaker }]`
   - `platform`: null (recorded in browser)
   - `is_client_visible`: false (default)
3. Upload audio to Supabase Storage
4. Update meeting with `recording_url`
5. Call the existing `/api/meetings/process-transcript` endpoint internally (use fetch with `http://localhost:3002/api/meetings/process-transcript` or better: extract the Claude extraction logic into a shared function)
   - Actually, to avoid a self-fetch, extract the Claude extraction logic from `src/app/api/meetings/process-transcript/route.ts` into a reusable function at `src/lib/services/transcript-extraction-service.ts` and call it directly
   - Both the API route and this service should use the extracted function
6. Update meeting with extracted title, summary, and action_items
7. Create tasks from extracted data (use pattern from existing code if task creation exists, otherwise insert directly)
8. Create auto time entry:
   - `client_id`: from params
   - `crm_customer_id`: from params if provided
   - `category`: "meeting"
   - `description`: extracted meeting title
   - `started_at`: current time minus duration
   - `stopped_at`: current time
   - `duration_minutes`: `roundUpTo15(Math.ceil(durationSeconds / 60))`
   - `is_manual`: false
   - `meeting_id`: the created meeting ID
   - `is_billable`: true
   - `is_client_visible`: false
9. Return the result

### 2. Create transcript extraction service at `src/lib/services/transcript-extraction-service.ts`

Extract the Claude API call logic from `src/app/api/meetings/process-transcript/route.ts` into a reusable function:

```typescript
export async function extractMeetingData(
  transcript: string,
  filename?: string,
): Promise<{
  title: string;
  summary: string;
  tasks: Array<{
    title: string;
    description: string;
    priority: string;
    assignee: string | null;
    assignee_type: string;
    confidence: string;
    source_quote: string;
  }>;
  metadata: {
    durationMinutes: number;
    speakers: string[];
    meetingDate: string | null;
  };
}>;
```

- Move the system prompt and Claude API call from the route handler into this function
- Update `src/app/api/meetings/process-transcript/route.ts` to use this extracted function (so existing transcript upload flow still works)
- This avoids the anti-pattern of a server-side service calling its own HTTP API

### 3. Create Supabase Storage bucket setup

Create `supabase/migrations/008_meeting_recordings_bucket.sql`:

```sql
-- Create storage bucket for meeting recordings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meeting-recordings',
  'meeting-recordings',
  false,
  524288000,  -- 500MB
  ARRAY['audio/webm', 'audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/ogg', 'audio/x-m4a', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "Users can upload own recordings"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: users can read own recordings
CREATE POLICY "Users can read own recordings"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- RLS: users can delete own recordings
CREATE POLICY "Users can delete own recordings"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'meeting-recordings'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
```

### 4. Create server action for recording processing at `src/lib/actions/recording.ts`

```typescript
"use server";

export async function processRecordingAction(
  formData: FormData,
): Promise<{ meetingId: string } | { error: string }>;
```

- Extract segments JSON, audio file, duration from FormData
- Get user ID from `createClient()` (server) auth
- Get active client ID from `getActiveClientId()`
- Call `recordingService.processRecording()`
- Revalidate `/meetings` path
- Return meeting ID on success

### 5. Update recording container to use the server action

In `src/components/meetings/recording-container.tsx` (from PROMPT 04):

- Update the `onComplete` handler to:
  1. Show processing state (spinner with "Processing recording...")
  2. Create FormData with segments JSON, audio blob, duration
  3. Call `processRecordingAction(formData)`
  4. On success: show success toast, redirect to `/meetings` (or meeting detail if available)
  5. On error: show error toast with retry button

### 6. Add `ANTHROPIC_API_KEY` to `.env.local.example` if not already present

Check existing `.env.local.example` and add if missing:

```
# Anthropic (meeting transcript extraction)
ANTHROPIC_API_KEY=
```

### 7. Write Vitest tests

Create `src/lib/services/__tests__/recording-service.test.ts`:

- Test `segmentsToSrt()` produces valid SRT that `parseTranscript()` can parse back
- Test roundtrip: segments -> SRT -> parseTranscript -> verify data matches
- Test `processRecording()` with mocked Supabase, mocked extraction service
- Test time entry is created with correct rounded duration
- Test audio upload path format

Create `src/lib/services/__tests__/transcript-extraction-service.test.ts`:

- Mock `@anthropic-ai/sdk`
- Test extraction returns structured data
- Test handles malformed Claude response gracefully

Create `src/lib/actions/__tests__/recording.test.ts`:

- Mock recording service and auth
- Test successful processing returns meeting ID
- Test error handling

## Acceptance Criteria

- [ ] `segmentsToSrt()` converts TranscriptSegment[] to valid SRT format
- [ ] SRT output is parseable by existing `parseTranscript()` function (roundtrip test)
- [ ] Audio uploaded to Supabase Storage bucket `meeting-recordings`
- [ ] Meeting record created with transcript, attendees, duration
- [ ] Claude extraction runs on the SRT transcript (via extracted service, not HTTP self-call)
- [ ] Meeting updated with extracted title, summary, action_items
- [ ] Tasks created from extraction results
- [ ] Time entry auto-created with duration rounded up to nearest 15 minutes
- [ ] Existing `/api/meetings/process-transcript` endpoint still works (refactored to use shared service)
- [ ] Processing state shown in UI during extraction
- [ ] Success redirects to meetings page, error shows retry
- [ ] Migration creates storage bucket with RLS
- [ ] `ANTHROPIC_API_KEY` in `.env.local.example`
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. The most critical test is the SRT roundtrip: segments -> `segmentsToSrt()` -> `parseTranscript()` -> verify segments match. This ensures compatibility with the existing transcript processing pipeline. Mock Supabase storage, the Anthropic SDK, and auth.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] SRT format matches transcript-parser.ts regex exactly
- [ ] Time rounding uses roundUpTo15 per project convention
- [ ] Extraction service refactor doesn't break existing process-transcript route
- [ ] Migration number 008 follows existing sequence

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_05-post-recording-pipeline.md`

---

## Implementation Notes — 2026-04-01 21:09

- **Commit:** (pending — run /commit when ready)
- **Tests:** 285 passed, 34 test files, 0 failures
- **Verification URL:** N/A (no web UI for server-side pipeline)
- **Playwright check:** N/A — service layer, no UI changes beyond recording container wiring
- **Changes summary:**
  - Created `src/lib/services/transcript-extraction-service.ts` — extracts Claude API call from route into reusable function
  - Updated `src/app/api/meetings/process-transcript/route.ts` — refactored to use extraction service (existing API endpoint still works)
  - Created `src/lib/services/recording-service.ts` — `segmentsToSrt()`, `uploadAudio()`, `processRecording()` orchestrator
  - Created `supabase/migrations/008_meeting_recordings_bucket.sql` — storage bucket with RLS policies
  - Created `src/lib/actions/recording.ts` — `processRecordingAction` server action
  - Updated `src/components/meetings/recording-container.tsx` — calls server action on save, shows toast, redirects to /meetings
  - Updated `src/components/meetings/meeting-list.tsx` — removed duplicate toast (container handles it now)
  - Updated `.env.local.example` — added ANTHROPIC_API_KEY
  - Created 3 new test files: recording-service, transcript-extraction-service, recording action
  - Updated recording-container.test.tsx — added mocks for server action, router, toast
- **Deviations from plan:** None material. `onComplete` prop kept as optional (no args) for backward compat with meeting-list.tsx sheet closing behavior.
- **Follow-up issues:** Storage bucket migration needs to be applied to Supabase instance; `ANTHROPIC_API_KEY` needs to be set in production env.

---

## Testing Checklist — 2026-04-01 21:09

**Check the changes:** Run `npm test` (all 285 tests pass)

- [x] All 285 tests pass with 0 failures
- [x] SRT roundtrip: segments → segmentsToSrt() → parseTranscript() → verified exact match
- [x] processRecordingAction returns meetingId on success
- [x] Error cases handled (unauthenticated, missing audio, invalid JSON)
- [x] Extraction service handles malformed Claude response
- [x] Recording container calls server action on Save & Process
- [x] Recording container redirects to /meetings on success
- [x] Recording container shows error toast and reverts to review on failure

### Actions for David

1. Apply migration `008_meeting_recordings_bucket.sql` to your Supabase instance
2. Add `ANTHROPIC_API_KEY` to `.env.local` (and production env vars)
3. Test the full recording flow in the browser to confirm audio upload and Claude extraction work end-to-end

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_05-post-recording-pipeline.md`

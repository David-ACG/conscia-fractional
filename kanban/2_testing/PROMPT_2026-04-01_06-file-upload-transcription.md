# PROMPT 06: Audio/Video File Upload + Batch Transcription

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application. It uses Supabase (PostgreSQL with RLS) for auth and database. All server actions use `createAdminClient` from `src/lib/supabase/admin.ts`. UI uses Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons. Testing with Vitest (`npm test`).

Key files and dependencies from prior prompts:

- Transcription service: `src/lib/services/transcription-service.ts` (PROMPT 02) — has `transcribeBatch(audioUrl, config)` and `transcribeBatchFromBuffer(buffer, mimetype, config)` returning `TranscriptSegment[]`
- Transcription types: `src/lib/types/transcription.ts` (PROMPT 02) — `TranscriptSegment { text, startMs, endMs, speaker, confidence }`
- Recording service: `src/lib/services/recording-service.ts` (PROMPT 05) — has `processRecording(params)`, `segmentsToSrt(segments)`, `uploadAudio(blob, userId, meetingId)`
- Transcript extraction service: `src/lib/services/transcript-extraction-service.ts` (PROMPT 05) — `extractMeetingData(transcript)`
- Recording server action: `src/lib/actions/recording.ts` (PROMPT 05) — `processRecordingAction(formData)`
- Live transcript component: `src/components/meetings/live-transcript.tsx` (PROMPT 04) — reusable transcript display/edit component
- Existing transcript upload: `src/components/meetings/transcript-upload.tsx` — handles `.txt` file upload
- Existing meeting list: `src/components/meetings/meeting-list.tsx` — client component with meeting list UI
- Supabase Storage bucket: `meeting-recordings` (PROMPT 05 migration) — accepts audio/video MIME types
- Batch transcription API: `POST /api/transcription/batch` (PROMPT 02) — accepts `{ audioUrl, config }`, returns `{ segments, speakers, durationMs }`

## Task

### 1. Create upload progress component at `src/components/meetings/upload-progress.tsx`

A client component showing multi-step progress for file upload and transcription.

**Props:**

```typescript
interface UploadProgressProps {
  stage:
    | "idle"
    | "uploading"
    | "transcribing"
    | "reviewing"
    | "processing"
    | "complete"
    | "error";
  uploadProgress: number; // 0-100 percentage
  fileName: string;
  fileSize: number; // bytes
  errorMessage?: string;
  onCancel: () => void;
  onRetry: () => void;
}
```

**UI layout:**

- Card with the file name and formatted file size (KB/MB/GB)
- Progress stages displayed as a stepper:
  1. "Upload" — shows upload progress bar (0-100%)
  2. "Transcribe" — shows spinner with "Transcribing audio..." text
  3. "Review" — shows check icon when reached
  4. "Process" — shows spinner during Claude extraction
- Use `Progress` component from `src/components/ui/progress.tsx` for the upload bar
- Current stage highlighted, completed stages show green check
- Cancel button (visible during upload and transcription stages)
- Error state: red alert with error message and "Retry" button
- Compact design — fits in a card alongside other content

### 2. Create file upload transcription component at `src/components/meetings/file-upload-transcription.tsx`

A client component managing the full file upload + transcription flow.

**Props:**

```typescript
interface FileUploadTranscriptionProps {
  onComplete: (data: {
    segments: TranscriptSegment[];
    audioUrl: string;
    durationSeconds: number;
    fileName: string;
  }) => void;
  onDiscard: () => void;
  className?: string;
}
```

**UI layout and flow:**

**Stage 1: File Selection**

- Drag-and-drop zone using a `div` with `onDragOver`/`onDrop` handlers
- Styled with dashed border, icon (Upload from lucide-react), and text:
  - "Drop audio or video file here"
  - "or click to browse"
  - Supported formats listed below: "MP3, WAV, MP4, MOV, WebM, M4A, OGG"
- Hidden `<input type="file" accept=".mp3,.wav,.mp4,.mov,.webm,.m4a,.ogg,audio/*,video/*">`
- File size validation: max 500MB. Show error if exceeded.
- After selection: show file info (name, size, format icon) with "Remove" button

**Stage 2: Upload + Transcription**

- On "Transcribe" button click:
  1. Set stage to 'uploading'
  2. Upload file to Supabase Storage using `createClient()` (browser client) — use `supabase.storage.from('meeting-recordings').upload(path, file, { onUploadProgress })` for progress tracking
  3. Path: `uploads/{timestamp}_{filename}` (temporary path, will be moved to proper location after meeting is created)
  4. On upload complete: get the signed URL
  5. Set stage to 'transcribing'
  6. Call `POST /api/transcription/batch` with the audio URL
  7. Receive `TranscriptSegment[]` back
  8. Set stage to 'reviewing'
- Show `<UploadProgress>` component during stages 2-3
- Cancel: abort the upload/fetch, delete the uploaded file from storage

**Stage 3: Review**

- Show `<LiveTranscript>` component (from PROMPT 04) with `isLive={false}` for editing
- Speaker names and text editable
- Show audio playback: `<audio controls src={signedUrl}>` for the uploaded file
- Two buttons:
  - "Process & Save" (primary) — calls `onComplete` with segments, audioUrl, duration, fileName
  - "Discard" (destructive) — confirmation dialog, deletes uploaded file from storage, calls `onDiscard`

**Duration calculation:**

- Use `<audio>` element's `loadedmetadata` event to get `duration` in seconds
- Or calculate from last segment's `endMs`

### 3. Update the meetings page to support file upload

In `src/components/meetings/meeting-list.tsx`:

- Add an "Upload Recording" button next to the existing "Record Meeting" button (from PROMPT 04)
- Use `FileUp` icon from lucide-react
- Clicking opens `<FileUploadTranscription>` in a Sheet (same pattern as recording)
- On `onComplete`:
  1. Create FormData with segments JSON, audioUrl (not blob — it's already uploaded), duration, fileName
  2. Call a new server action `processUploadedRecordingAction(formData)` (see below)
  3. Show processing toast
  4. On success: close sheet, refresh meetings list
- On `onDiscard`: close sheet

### 4. Create server action for uploaded file processing at `src/lib/actions/recording.ts`

Add to the existing file from PROMPT 05:

```typescript
export async function processUploadedRecordingAction(
  formData: FormData,
): Promise<{ meetingId: string } | { error: string }>;
```

- Extract segments JSON, audioUrl, duration, fileName from FormData
- Get user ID from auth, active client ID
- Reuse `recordingService.processRecording()` but adapt:
  - Don't re-upload audio (it's already in storage) — just pass the URL
  - Create meeting with `recording_url` set to the storage URL
  - Run Claude extraction on the SRT transcript
  - Create time entry (rounded to 15 min)
- OR create a lighter-weight method in recording-service that accepts an already-uploaded URL instead of a blob

### 5. Ensure existing `.txt` transcript upload still works

The existing `<TranscriptUpload>` component in `src/components/meetings/transcript-upload.tsx` must continue to work unchanged. The new file upload is a separate flow that coexists alongside it:

- `.txt` files → existing transcript upload flow (direct text parsing)
- Audio/video files → new file upload transcription flow (Deepgram → review → Claude)

If the current meeting-list.tsx already has a transcript upload button/area, keep it. Add the new "Upload Recording" button as a separate action.

### 6. Update Deepgram transcription service

In `src/lib/services/transcription-service.ts` (from PROMPT 02), ensure `transcribeBatch` is fully implemented:

```typescript
async transcribeBatch(audioUrl: string, config?: TranscriptionConfig): Promise<TranscriptSegment[]> {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY!)
  const { result } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: audioUrl },
    {
      model: config?.model ?? 'nova-3',
      smart_format: config?.smart_format ?? true,
      diarize: config?.diarize ?? true,
      punctuate: config?.punctuate ?? true,
      utterances: config?.utterances ?? true,
    }
  )
  return deepgramResponseToSegments(result)
}
```

The `deepgramResponseToSegments` helper should:

- Prefer `result.results.utterances` if available (better diarization)
- Fall back to `result.results.channels[0].alternatives[0].words` grouped by speaker
- Map speaker numbers (0, 1, 2) to "Speaker 1", "Speaker 2", "Speaker 3"
- Return `TranscriptSegment[]`

### 7. Write Vitest tests

Create `src/components/meetings/__tests__/upload-progress.test.tsx`:

- Test renders each stage correctly (uploading, transcribing, reviewing, processing, error)
- Test progress bar shows correct percentage during upload
- Test cancel button visibility per stage
- Test error state with retry button

Create `src/components/meetings/__tests__/file-upload-transcription.test.tsx`:

- Mock Supabase storage client
- Mock fetch for `/api/transcription/batch`
- Test file selection via input and drag-and-drop
- Test file size validation (reject > 500MB)
- Test upload progress updates
- Test transcript review phase renders LiveTranscript
- Test "Process & Save" calls onComplete with correct data
- Test "Discard" deletes uploaded file and calls onDiscard

Create `src/lib/actions/__tests__/recording-upload.test.ts`:

- Test `processUploadedRecordingAction` with mocked services
- Test error handling for missing fields

## Acceptance Criteria

- [ ] Drag-and-drop zone accepts MP3, WAV, MP4, MOV, WebM, M4A, OGG files
- [ ] File size validation rejects files over 500MB with clear error message
- [ ] File uploaded to Supabase Storage with progress indicator
- [ ] Deepgram batch transcription called with uploaded file URL
- [ ] Transcription progress shown (spinner during transcription)
- [ ] Transcript preview shown using LiveTranscript component in edit mode
- [ ] Speaker names and text editable in review
- [ ] Audio playback available in review phase
- [ ] "Process & Save" triggers Claude extraction and meeting/task/time-entry creation
- [ ] "Discard" cleans up uploaded file from storage
- [ ] Cancel button stops upload/transcription in progress
- [ ] Existing `.txt` transcript upload flow unchanged and still works
- [ ] "Upload Recording" button added to meetings page alongside "Record Meeting"
- [ ] Error handling with retry for upload failures, transcription failures
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. Mock Supabase storage (upload, getPublicUrl, remove), the Deepgram batch API response, and the recording server action. Test the drag-and-drop interaction using `@testing-library/react` with `fireEvent.drop`. Test file size validation edge cases.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Existing transcript upload flow explicitly preserved
- [ ] File upload uses browser Supabase client (not admin) for proper RLS
- [ ] Storage path strategy avoids collisions
- [ ] Batch transcription flow correctly chains upload -> transcribe -> review -> process

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_06-file-upload-transcription.md`

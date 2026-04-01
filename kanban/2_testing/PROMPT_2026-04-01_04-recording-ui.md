# PROMPT 04: Meeting Recording UI Component

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application. UI uses Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons. Testing with Vitest (`npm test`).

Key files and dependencies from prior prompts:

- `src/hooks/use-audio-capture.ts` (PROMPT 03) — hook returning `{ isRecording, isPaused, duration, audioLevel, error, startCapture, stopCapture, pauseCapture, resumeCapture, getAudioChunks }`
- `src/lib/audio-level.ts` (PROMPT 03) — `AudioLevelMonitor` class for waveform data
- `src/lib/browser-compat.ts` (PROMPT 03) — `checkAudioSupport()` returning `AudioCapabilities`
- `src/lib/types/transcription.ts` (PROMPT 02) — `TranscriptSegment { text, startMs, endMs, speaker, confidence }`
- `POST /api/transcription/token` (PROMPT 02) — returns `{ key, expiresAt }` for client-side Deepgram
- `@deepgram/sdk` installed (PROMPT 02)
- Existing meeting components: `src/components/meetings/meeting-form.tsx`, `meeting-list.tsx`, `meeting-detail.tsx`, `transcript-upload.tsx`
- Existing meetings page: `src/app/(dashboard)/meetings/page.tsx` — server component rendering `<MeetingList>`
- Meeting list component: `src/components/meetings/meeting-list.tsx` — has existing "Upload Transcript" functionality
- UI components available: `Button`, `Card`, `Badge`, `Dialog`, `Sheet`, `Tabs`, `Select`, `Separator`, `Progress` from `src/components/ui/`
- Lucide icons available: import from `lucide-react`

## Task

### 1. Create recording panel component at `src/components/meetings/recording-panel.tsx`

A client component (`"use client"`) with recording controls.

**Props:**

```typescript
interface RecordingPanelProps {
  onAudioData: (chunks: Blob[]) => void; // called on stop with audio chunks
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void; // live segments
  className?: string;
}
```

**UI layout:**

- Card with header "Recording" and status badge
- **Audio source selector** (before recording starts):
  - Radio group or Select with options:
    - "Microphone only" (always available)
    - "Tab audio + Microphone" (only if `checkAudioSupport().tabAudio`)
    - "System audio + Microphone" (only if `checkAudioSupport().systemAudio`)
  - Show browser compatibility warning from `checkAudioSupport().warnings` as a muted text note
- **Controls row:**
  - Start Recording button (Mic icon, red bg) — large, prominent
  - When recording: Pause/Resume button (Pause/Play icon), Stop button (Square icon, red)
  - Disabled states: Start disabled while recording, Pause/Stop disabled while not recording
- **Status indicator:**
  - Red pulsing dot (`animate-pulse`) + "Recording" text when recording
  - Yellow dot + "Paused" text when paused
  - Grey dot + "Ready" text when idle
- **Duration counter:** `MM:SS` format, updates every second from `use-audio-capture` hook's `duration`
- **Waveform visualiser:**
  - Canvas element, width 100%, height 48px
  - Draw bars representing audio level from the `audioLevel` value (0-1)
  - Use a `useRef` for canvas, draw with `requestAnimationFrame`
  - Bar color: `hsl(var(--primary))` when recording, `hsl(var(--muted))` when paused
  - Keep a rolling window of ~60 level samples for a waveform effect (not just a single bar)

### 2. Create live transcript panel at `src/components/meetings/live-transcript.tsx`

A client component displaying real-time transcript segments.

**Props:**

```typescript
interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  onSegmentEdit: (
    index: number,
    field: "speaker" | "text",
    value: string,
  ) => void;
  isLive: boolean; // true during recording, false during review
  className?: string;
}
```

**UI layout:**

- Scrollable container with `max-h-[400px] overflow-y-auto`
- Each segment rendered as a row:
  - **Speaker label** (left, bold, colored by speaker): clickable to edit. When clicked, show an inline input. On blur/enter, call `onSegmentEdit(index, 'speaker', newValue)` and update ALL segments with the same old speaker name (batch rename)
  - **Timestamp** (muted, small): format `startMs` as `MM:SS`
  - **Text** (right): clickable to edit in review mode (`isLive = false`). When clicked, show inline textarea. On blur/enter, call `onSegmentEdit(index, 'text', newValue)`
- Auto-scroll to bottom when `isLive` is true and new segments arrive (use `useEffect` with a ref to scroll container)
- Empty state: "Waiting for speech..." with a subtle animation when `isLive` and no segments yet
- Speaker colors: assign consistent colors from a palette based on speaker name (hash the name to pick from 6-8 predefined Tailwind colors)

### 3. Create recording container at `src/components/meetings/recording-container.tsx`

A client component managing the full recording lifecycle.

**Props:**

```typescript
interface RecordingContainerProps {
  onComplete: (data: {
    segments: TranscriptSegment[];
    audioBlob: Blob;
    durationSeconds: number;
  }) => void;
  onDiscard: () => void;
  className?: string;
}
```

**States/phases:**

1. **Setup** — shows RecordingPanel in idle state, user selects audio source
2. **Recording** — RecordingPanel active + LiveTranscript showing segments
3. **Review** — Recording stopped, shows full transcript in edit mode + audio playback
4. **Saving** — Processing spinner (handed off to parent via `onComplete`)

**Recording phase implementation:**

- On start: fetch temporary Deepgram key from `POST /api/transcription/token`
- Connect to Deepgram WebSocket using `@deepgram/sdk` browser client:
  ```typescript
  import { createClient, LiveTranscriptionEvents } from "@deepgram/sdk";
  const deepgram = createClient(temporaryKey);
  const connection = deepgram.listen.live({
    model: "nova-3",
    smart_format: true,
    diarize: true,
    punctuate: true,
    utterances: true,
    interim_results: false,
  });
  ```
- Feed audio chunks from `use-audio-capture` to Deepgram connection via `connection.send(chunk)`
- Listen for `LiveTranscriptionEvents.Transcript` events, extract utterances, convert to `TranscriptSegment[]`
- Accumulate segments in state

**Review phase:**

- Show LiveTranscript with `isLive={false}` for editing
- Audio playback: `<audio>` element with the recorded blob URL (`URL.createObjectURL(audioBlob)`)
- Two buttons at bottom:
  - "Save & Process" (primary) — calls `onComplete` with segments, audio blob, duration
  - "Discard" (destructive variant) — shows confirmation dialog ("Are you sure? This recording will be lost."), then calls `onDiscard`

### 4. Integrate into meetings page

The meetings page is a server component at `src/app/(dashboard)/meetings/page.tsx` that renders `<MeetingList>`. The `MeetingList` component at `src/components/meetings/meeting-list.tsx` is the client component with the UI.

In `src/components/meetings/meeting-list.tsx`:

- Add a "Record Meeting" button next to the existing UI controls (look at existing button placement in the file)
- Use `Mic` icon from lucide-react
- Clicking opens the RecordingContainer in a full-width Sheet (slide-in panel from the right) or a Dialog
- On `onComplete`: close the sheet, trigger the post-recording pipeline (PROMPT 05 will handle the actual processing — for now, just close the sheet and show a toast "Recording saved. Processing...")
- On `onDiscard`: close the sheet

Add a `"use client"` wrapper component if needed to handle the sheet state, since the meetings page is a server component.

### 5. Write Vitest tests

Create `src/components/meetings/__tests__/recording-panel.test.tsx`:

- Mock `use-audio-capture` hook
- Mock `checkAudioSupport`
- Test renders with all controls in idle state
- Test start button calls `startCapture`
- Test pause/resume toggles
- Test duration display formats correctly
- Test browser compatibility warnings shown

Create `src/components/meetings/__tests__/live-transcript.test.tsx`:

- Test renders segments with speaker names and text
- Test auto-scroll behavior when isLive
- Test speaker name edit triggers onSegmentEdit for all matching segments
- Test text edit triggers onSegmentEdit
- Test empty state when no segments

Create `src/components/meetings/__tests__/recording-container.test.tsx`:

- Mock fetch for `/api/transcription/token`
- Mock `@deepgram/sdk` client
- Test phase transitions: setup -> recording -> review
- Test discard shows confirmation dialog
- Test "Save & Process" calls onComplete with correct data

## Acceptance Criteria

- [ ] Recording panel renders with audio source selector and all controls
- [ ] Waveform visualiser updates with audio level using canvas
- [ ] Duration counter displays MM:SS format and updates during recording
- [ ] Status indicator shows recording (red pulse), paused (yellow), ready (grey)
- [ ] Live transcript displays segments with speaker labels and timestamps
- [ ] Speaker name click enables batch rename across all segments
- [ ] Transcript text editable in review mode
- [ ] Auto-scroll to latest segment during live recording
- [ ] Recording container manages setup -> recording -> review -> save lifecycle
- [ ] Deepgram live connection established with temporary key
- [ ] Audio chunks sent to Deepgram, transcript segments received and displayed
- [ ] Review phase shows audio playback and editable transcript
- [ ] "Save & Process" and "Discard" buttons work correctly
- [ ] "Record Meeting" button added to meetings page
- [ ] Sheet/dialog opens and closes properly
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. Mock all browser APIs (MediaRecorder, AudioContext, canvas), the Deepgram SDK, and fetch calls. Use `@testing-library/react` for component rendering and interaction tests.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Deepgram SDK browser client usage pattern is correct
- [ ] MeetingList integration approach accounts for server/client component boundary
- [ ] All referenced components from prior prompts are listed with correct paths

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_04-recording-ui.md`

---

## Implementation Notes — 2026-04-01 20:58

- **Commit:** no commits yet (untracked files)
- **Tests:** 263 passed, 0 failed (`npm test`)
- **Verification URL:** N/A (no dev server running)
- **Playwright check:** skipped (no running server)
- **Changes summary:**
  - Created `src/components/meetings/recording-panel.tsx` — self-contained recording controls with waveform canvas, source selector, status badge, duration counter; uses `useAudioCapture` + `checkAudioSupport`
  - Created `src/components/meetings/live-transcript.tsx` — scrollable transcript display with speaker batch-rename, inline text editing, auto-scroll, speaker colors
  - Created `src/components/meetings/recording-container.tsx` — lifecycle manager (setup→recording→review→saving); fetches Deepgram token on recording start, feeds chunks via `onChunk` prop, manages audio blob + review phase
  - Updated `src/components/meetings/meeting-list.tsx` — added "Record Meeting" button (Mic icon) + Sheet slide-in panel; on complete shows toast "Recording saved. Processing..."
  - Created `src/components/meetings/__tests__/recording-panel.test.tsx` (12 tests)
  - Created `src/components/meetings/__tests__/live-transcript.test.tsx` (10 tests)
  - Created `src/components/meetings/__tests__/recording-container.test.tsx` (12 tests)
- **Deviations from plan:** Added `onRecordingStart` and `onChunk` props to `RecordingPanel` beyond the spec's three props; needed to trigger Deepgram setup when recording begins and stream chunks in real time. The spec's `onTranscriptUpdate` prop is accepted but unused by RecordingPanel (transcription is managed by RecordingContainer). The container mocks out RecordingPanel in tests for clean phase-transition testing.
- **Follow-up issues:** PROMPT 05 will handle post-recording processing pipeline (the `onComplete` callback currently just shows a toast)

---

## Testing Checklist — 2026-04-01 20:58

**Check the changes:** N/A — no running server; use `npm run dev` to start locally

- [ ] Page loads without errors
- [ ] "Record Meeting" button appears next to "Process Recording" in meetings toolbar
- [ ] Clicking "Record Meeting" opens right-side Sheet panel
- [ ] RecordingPanel shows "Microphone only" radio option and "Start Recording" button
- [ ] Clicking "Start Recording" requests microphone permission and starts recording
- [ ] Duration counter ticks up in MM:SS format while recording
- [ ] Pause/Resume toggle works (yellow "Paused" badge ↔ red "Recording" badge)
- [ ] Stopping recording transitions to Review phase with audio playback
- [ ] Transcript segments (if Deepgram responds) appear in live transcript panel
- [ ] Speaker names clickable and batch-rename works across all matching segments
- [ ] Text segments editable in review mode (not during live recording)
- [ ] "Save & Process" shows toast "Recording saved. Processing..." and closes sheet
- [ ] "Discard" shows confirmation dialog; confirming closes sheet without saving
- [ ] No console errors

### Actions for David

Start the dev server (`npm run dev`), go to the Meetings page, and tick the boxes above. The Deepgram integration requires a valid key from `/api/transcription/token` (PROMPT 02).

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_04-recording-ui.md`

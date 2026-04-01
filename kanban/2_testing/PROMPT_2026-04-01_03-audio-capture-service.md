# PROMPT 03: Browser Audio Capture Service

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application. UI uses Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons. Testing with Vitest (`npm test`).

Key files:

- Existing hooks: `src/hooks/use-sidebar.ts` — follow this pattern for new hooks
- Transcription types from PROMPT 02: `src/lib/types/transcription.ts` — `TranscriptSegment { text, startMs, endMs, speaker, confidence }`
- The `@deepgram/sdk` package is installed (from PROMPT 02)
- API route `POST /api/transcription/token` returns `{ key, expiresAt }` for client-side Deepgram connection (from PROMPT 02)

## Task

### 1. Create audio capture hook at `src/hooks/use-audio-capture.ts`

A React hook that manages browser audio recording using Web Audio API and MediaRecorder.

**Interface:**

```typescript
interface AudioCaptureOptions {
  microphone: boolean; // capture mic input
  tabAudio: boolean; // capture browser tab audio (Chromium getDisplayMedia)
  systemAudio: boolean; // capture system audio (Chromium getDisplayMedia)
}

interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds elapsed
  audioLevel: number; // 0-1 normalised
  error: string | null;
  mediaRecorder: MediaRecorder | null;
}

interface UseAudioCaptureReturn extends AudioCaptureState {
  startCapture: (options: AudioCaptureOptions) => Promise<void>;
  stopCapture: () => Blob | null; // returns combined WebM blob
  pauseCapture: () => void;
  resumeCapture: () => void;
  getAudioChunks: () => Blob[]; // access raw chunks
}
```

**Implementation details:**

- `startCapture`:
  1. If `microphone` is true, call `navigator.mediaDevices.getUserMedia({ audio: true })`
  2. If `tabAudio` or `systemAudio` is true, call `navigator.mediaDevices.getDisplayMedia({ audio: true, video: false })` — note: Chrome requires video to be included in getDisplayMedia, so use `{ audio: true, video: true }` and discard the video track immediately with `videoTrack.stop()`
  3. If both mic and tab/system audio requested, mix streams using `AudioContext`:
     - Create `AudioContext`
     - Create `MediaStreamSource` for each stream
     - Create `MediaStreamDestination`
     - Connect both sources to destination
     - Use `destination.stream` as the combined stream
  4. Create `MediaRecorder` on the final stream with `mimeType: 'audio/webm;codecs=opus'` (fallback to `'audio/webm'` if opus not supported)
  5. Set `timeslice: 250` in `MediaRecorder.start(250)` for 250ms chunk intervals
  6. Collect chunks in a ref array via `ondataavailable`
  7. Start a `setInterval` for duration counter (every 1000ms)
  8. Start audio level monitoring (see use-audio-level below)
- `stopCapture`:
  1. Stop the MediaRecorder
  2. Stop all tracks on all MediaStreams
  3. Close AudioContext if created
  4. Clear duration interval
  5. Return combined blob: `new Blob(chunks, { type: 'audio/webm' })`
- `pauseCapture`: Call `mediaRecorder.pause()`, pause duration counter
- `resumeCapture`: Call `mediaRecorder.resume()`, resume duration counter
- Handle errors:
  - `NotAllowedError` → "Microphone access denied. Please allow microphone access in your browser settings."
  - `NotFoundError` → "No microphone found. Please connect a microphone."
  - Tab audio denied → "Tab audio sharing was cancelled. Recording with microphone only."
  - Generic → "Recording failed: {error.message}"
- Cleanup on unmount: stop all tracks, close AudioContext, stop MediaRecorder

### 2. Create audio level utility at `src/lib/audio-level.ts`

```typescript
export class AudioLevelMonitor {
  private analyser: AnalyserNode;
  private dataArray: Uint8Array;
  private animationFrameId: number | null = null;
  private onLevel: (level: number) => void;

  constructor(
    audioContext: AudioContext,
    source: MediaStreamAudioSourceNode,
    onLevel: (level: number) => void,
  );

  start(): void; // begins requestAnimationFrame loop
  stop(): void; // cancels animation frame
  getLevel(): number; // returns current level 0-1
}
```

- Use `AnalyserNode` with `fftSize: 256`
- Read `getByteFrequencyData` into a `Uint8Array`
- Calculate RMS (root mean square) of the frequency data
- Normalise to 0-1 range
- Call `onLevel` callback with the normalised value on each animation frame

### 3. Create browser compatibility check at `src/lib/browser-compat.ts`

```typescript
export interface AudioCapabilities {
  microphone: boolean; // getUserMedia available
  tabAudio: boolean; // getDisplayMedia with audio available (Chromium)
  systemAudio: boolean; // getDisplayMedia with system audio (Chromium)
  mediaRecorder: boolean; // MediaRecorder API available
  audioContext: boolean; // Web Audio API available
  warnings: string[]; // human-readable warnings for unsupported features
}

export function checkAudioSupport(): AudioCapabilities;
```

- Check `navigator.mediaDevices?.getUserMedia` exists
- Check `navigator.mediaDevices?.getDisplayMedia` exists
- Detect Chromium: check `window.chrome` or user agent for Chrome/Edge/Brave/Opera
- For non-Chromium: `tabAudio = false`, `systemAudio = false`, add warning "Tab/system audio capture requires Chrome, Edge, or another Chromium-based browser"
- Check `window.MediaRecorder` exists
- Check `window.AudioContext || window.webkitAudioContext` exists
- Return capabilities object with accumulated warnings

### 4. Write Vitest tests

Create `src/hooks/__tests__/use-audio-capture.test.ts`:

- Mock `navigator.mediaDevices.getUserMedia` to return a fake MediaStream
- Mock `navigator.mediaDevices.getDisplayMedia` to return a fake MediaStream
- Mock `MediaRecorder` class with start/stop/pause/resume methods
- Mock `AudioContext` with createMediaStreamSource/createMediaStreamDestination
- Test `startCapture` with microphone only
- Test `startCapture` with tab audio + mic (mixing)
- Test `stopCapture` returns blob and cleans up
- Test `pauseCapture`/`resumeCapture` toggle state
- Test error handling for denied permissions
- Test cleanup on unmount

Create `src/lib/__tests__/audio-level.test.ts`:

- Mock `AudioContext`, `AnalyserNode`, `requestAnimationFrame`
- Test level calculation returns value between 0 and 1
- Test start/stop lifecycle

Create `src/lib/__tests__/browser-compat.test.ts`:

- Test with all APIs available (Chromium)
- Test with getUserMedia only (Firefox/Safari)
- Test with no APIs available
- Test warning messages

## Acceptance Criteria

- [ ] `use-audio-capture` hook captures microphone audio via getUserMedia
- [ ] Hook captures tab audio via getDisplayMedia (Chromium)
- [ ] Mixed stream combines microphone and tab audio via Web Audio API
- [ ] Audio chunks emitted every 250ms via MediaRecorder timeslice
- [ ] Pause/resume toggles MediaRecorder state and duration counter
- [ ] Duration counter increments every second while recording
- [ ] Audio level monitor returns normalised 0-1 values via AnalyserNode
- [ ] Error handling provides clear messages for permission denials
- [ ] Browser compatibility check correctly detects Chromium vs other browsers
- [ ] All resources cleaned up on stopCapture and component unmount
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. All browser APIs (navigator.mediaDevices, MediaRecorder, AudioContext, requestAnimationFrame) must be mocked since they are not available in Node.js/jsdom. Use `vi.fn()` and `vi.stubGlobal()` for mocking.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Browser API mocking strategy is clear for tests
- [ ] getDisplayMedia quirk (requires video:true) is documented

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_03-audio-capture-service.md`

---

## Implementation Notes — 2026-04-01 20:47

- **Commit:** pending (no commits in repo yet)
- **Tests:** 227 passed, 0 failed (`npm test`)
- **Verification URL:** N/A (library code, no web UI)
- **Playwright check:** N/A (no UI component, pure hook/utility)
- **Changes summary:**
  - Created `src/hooks/use-audio-capture.ts` — full React hook with startCapture/stopCapture/pauseCapture/resumeCapture/getAudioChunks, AudioContext mixing, 250ms MediaRecorder timeslice, duration counter, level monitoring, error handling, cleanup on unmount
  - `src/lib/audio-level.ts` — already existed; AnalyserNode RMS level monitor
  - `src/lib/browser-compat.ts` — already existed; Chromium detection, API capability check
  - Created `src/hooks/__tests__/use-audio-capture.test.ts` — 21 tests covering all hook behaviours
  - Created `src/lib/__tests__/audio-level.test.ts` — 12 tests for AudioLevelMonitor
  - Created `src/lib/__tests__/browser-compat.test.ts` — 18 tests for checkAudioSupport
- **Deviations from plan:** audio-level.ts and browser-compat.ts already existed with complete implementations; only the hook and tests were new
- **Key fix during implementation:** vitest 4 does not support `vi.fn().mockImplementation(arrowFn)` as a constructor (`new`) — must use a proper `class` for mocks that are instantiated with `new`

---

## Testing Checklist — 2026-04-01 20:47

**Check the changes:** N/A (no running dev server — pure hook/utility code)

- [x] All 227 tests pass (`npm test`)
- [ ] `useAudioCapture` hook imported into a recording component and tested in browser
- [ ] Microphone capture works (getUserMedia permission prompt appears)
- [ ] Tab audio capture works on Chromium (getDisplayMedia picker appears)
- [ ] Mixed stream (mic + tab) produces audible combined audio
- [ ] Pause/resume toggles correctly
- [ ] Duration counter visible in UI increments/pauses correctly
- [ ] Audio level meter responds to microphone input
- [ ] `checkAudioSupport()` returns correct warnings on Firefox/Safari

### Actions for David

Review the new hook at `src/hooks/use-audio-capture.ts` — no UI wiring was in scope for this prompt. The next step is to create a recording component that calls `useAudioCapture` and wires it to the Deepgram live transcription hook from PROMPT 02.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_03-audio-capture-service.md`

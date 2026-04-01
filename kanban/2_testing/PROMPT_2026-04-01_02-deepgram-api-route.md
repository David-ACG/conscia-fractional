# PROMPT 02: Deepgram WebSocket Proxy API Route

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application. It uses Supabase for auth/DB. The site runs at `http://localhost:3002`.

Key files:

- Existing API routes: `src/app/api/timer/route.ts`, `src/app/api/meetings/process-transcript/route.ts`, etc.
- Existing transcript types in `src/lib/transcript-parser.ts`:
  ```typescript
  export interface TranscriptSegment {
    startMs: number;
    endMs: number;
    speaker: string;
    text: string;
  }
  ```
- Env example: `.env.local.example` — currently has Supabase, Google Gemini, and `ENCRYPTION_KEY` vars
- Supabase admin client: `src/lib/supabase/admin.ts` — `createAdminClient()` returns service role client
- Testing: Vitest (`npm test`)
- Packages already installed: `@anthropic-ai/sdk`, `@google/generative-ai`

## Task

### 1. Install `@deepgram/sdk`

Run `npm install @deepgram/sdk`

### 2. Add `DEEPGRAM_API_KEY` to `.env.local.example`

Add after the existing entries:

```
# Deepgram (speech-to-text)
DEEPGRAM_API_KEY=
```

### 3. Create transcription types at `src/lib/types/transcription.ts`

```typescript
export interface DeepgramTranscriptWord {
  word: string;
  start: number; // seconds
  end: number; // seconds
  confidence: number;
  speaker?: number;
  punctuated_word?: string;
}

export interface DeepgramTranscriptAlternative {
  transcript: string;
  confidence: number;
  words: DeepgramTranscriptWord[];
}

export interface TranscriptSegment {
  text: string;
  startMs: number;
  endMs: number;
  speaker: string;
  confidence: number;
}

export interface TranscriptionConfig {
  model?: string; // default: 'nova-3'
  language?: string; // default: 'en'
  smart_format?: boolean;
  diarize?: boolean;
  punctuate?: boolean;
  utterances?: boolean;
}
```

Note: The `TranscriptSegment` here extends the concept from `src/lib/transcript-parser.ts` by adding `confidence`. Both should be compatible. The existing `TranscriptSegment` in `transcript-parser.ts` does NOT have a `confidence` field, so this new type is a superset. When converting for the existing pipeline, the `confidence` field can simply be omitted.

### 4. Create transcription service at `src/lib/services/transcription-service.ts`

- Import `@deepgram/sdk`
- Create a singleton-style Deepgram client initialized with `process.env.DEEPGRAM_API_KEY`
- Methods:
  - `createTemporaryApiKey(): Promise<{ key: string; expiresAt: Date }>` — uses Deepgram's `manage.createProjectKey()` to create a key with limited TTL (60 seconds) and scoped to `usage:write` only. This allows the browser client to connect directly to Deepgram for live streaming without exposing the main API key.
  - `transcribeBatch(audioUrl: string, config?: TranscriptionConfig): Promise<TranscriptSegment[]>` — calls Deepgram's pre-recorded API with the audio URL, options: `{ model: 'nova-3', smart_format: true, diarize: true, punctuate: true, utterances: true }`, parses the response into `TranscriptSegment[]` format
  - `transcribeBatchFromBuffer(buffer: Buffer, mimetype: string, config?: TranscriptionConfig): Promise<TranscriptSegment[]>` — same as above but accepts a buffer directly (for uploaded files that aren't yet in storage)
- Helper: `deepgramResponseToSegments(response)` — converts Deepgram utterances/words into `TranscriptSegment[]`, mapping speaker numbers to "Speaker 1", "Speaker 2", etc.

### 5. Create API route at `src/app/api/transcription/token/route.ts`

- `POST` handler
- Requires authenticated user (check via `createClient()` from `@/lib/supabase/server`)
- Calls `transcriptionService.createTemporaryApiKey()`
- Returns JSON: `{ key: string, expiresAt: string }`
- Error handling: 401 if not authenticated, 500 if Deepgram API fails, 500 if `DEEPGRAM_API_KEY` not set

### 6. Create API route at `src/app/api/transcription/batch/route.ts`

- `POST` handler
- Requires authenticated user
- Accepts JSON body: `{ audioUrl: string, config?: TranscriptionConfig }`
- Calls `transcriptionService.transcribeBatch(audioUrl, config)`
- Returns JSON: `{ segments: TranscriptSegment[], speakers: string[], durationMs: number }`
- Error handling: 401, 400 (missing audioUrl), 500

### 7. Write Vitest tests

Create `src/lib/services/__tests__/transcription-service.test.ts`:

- Mock `@deepgram/sdk` module
- Test `createTemporaryApiKey()` returns key and expiry
- Test `transcribeBatch()` converts Deepgram response to `TranscriptSegment[]`
- Test `transcribeBatchFromBuffer()` works with buffer input
- Test `deepgramResponseToSegments()` correctly maps speakers
- Test error handling when API key is missing

Create `src/app/api/transcription/__tests__/token.test.ts`:

- Mock auth (authenticated and unauthenticated)
- Mock transcription service
- Test 200 response with valid key
- Test 401 when not authenticated
- Test 500 when Deepgram fails

Create `src/app/api/transcription/__tests__/batch.test.ts`:

- Mock auth and transcription service
- Test 200 with valid audio URL
- Test 400 with missing audioUrl
- Test 401 when not authenticated

## Acceptance Criteria

- [ ] `@deepgram/sdk` installed and in `package.json`
- [ ] `DEEPGRAM_API_KEY` added to `.env.local.example`
- [ ] Transcription types defined at `src/lib/types/transcription.ts`
- [ ] `src/lib/services/transcription-service.ts` has `createTemporaryApiKey`, `transcribeBatch`, and `transcribeBatchFromBuffer` methods
- [ ] `POST /api/transcription/token` returns temporary API key for authenticated users
- [ ] `POST /api/transcription/batch` transcribes audio from URL
- [ ] Deepgram response correctly mapped to `TranscriptSegment[]` with speaker labels
- [ ] All tests pass (`npm test`)

## Test Expectations

Run `npm test` — all new and existing tests must pass. The Deepgram SDK must be mocked in all tests (no real API calls). Test the response-to-segment mapping logic thoroughly as it's the critical transformation.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] TranscriptSegment type is compatible with existing transcript-parser.ts
- [ ] API route auth check pattern matches existing routes

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_02-deepgram-api-route.md`

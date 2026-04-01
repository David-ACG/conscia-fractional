# FractionalBuddy Integration Plan

_1 April 2026 — For David's review before breaking into kanban tasks_

---

## Important: Claude API Access

Your Claude Max subscription ($100-200/mo) does **not** include API access. They are completely separate billing systems. FractionalBuddy's transcript processing (`/api/meetings/process-transcript`) already requires an `ANTHROPIC_API_KEY` from the API Console.

**Options:**

1. **Sign up for Anthropic Console** (console.anthropic.com) — pay-as-you-go. Claude Sonnet 4: $3/M input, $15/M output tokens. A typical 1-hour meeting transcript costs ~$0.05-0.15 to process. Very cheap for your volume.
2. **Use Google Gemini instead** — you already have a `GOOGLE_GEMINI_API_KEY` for contract extraction. Gemini 1.5 Flash is free up to 15 RPM. Could swap the transcript processor to use Gemini instead of Claude.
3. **Use a local model via Ollama** — free, private, but lower quality for structured extraction tasks.

**Recommendation:** Option 1. The API costs for your usage (~5-10 meetings/week) would be under $5/month. The Max subscription and API Console are independent — having both is normal.

---

## Priority Order

| #   | Integration                       | Value    | Complexity     | Dependencies                      |
| --- | --------------------------------- | -------- | -------------- | --------------------------------- |
| 1   | Meeting Recording & Transcription | Critical | Medium-High    | Transcription service (Deepgram)  |
| 2   | Google Drive (multiple accounts)  | High     | Medium         | Google OAuth2                     |
| 3   | Slack Integration                 | High     | Medium         | Slack App + Events API            |
| 4   | Google Calendar Sync              | High     | Simple-Medium  | Google OAuth2 (shared with Drive) |
| 5   | Email Integration (Gmail)         | Medium   | Medium-Complex | Google OAuth2 (shared) + Pub/Sub  |
| 6   | RAG Document Q&A                  | Medium   | Medium         | pgvector or Qdrant                |

---

## 1. Meeting Recording & Transcription (Browser-Based)

### The Goal

Record meetings directly from FractionalBuddy in the browser on the P53, transcribe them, and feed into the existing Claude processing pipeline — no separate app needed.

### How Browser-Based Recording Works

**Audio Capture** uses two Web APIs:

1. **`getUserMedia()`** — captures your microphone (works in all browsers)
2. **`getDisplayMedia()`** — captures tab/system audio (Chromium only: Chrome, Edge)

For a meeting in a browser tab (Google Meet, Teams web, Zoom web):

- `getDisplayMedia({ audio: true })` captures the meeting's audio output (other participants)
- `getUserMedia({ audio: true })` captures your microphone
- Web Audio API mixes both streams together
- `MediaRecorder` records the mixed stream as WebM/Opus

For meetings in desktop apps (Teams desktop, Zoom desktop):

- `getDisplayMedia()` with `systemAudio: 'include'` captures all system audio (Windows + ChromeOS only)
- This works on your P53 (Windows) in Chrome/Edge

**Key UX consideration:** Chrome shows a sharing dialog where the user must check "Share tab audio" (not checked by default). The UI needs to guide the user through this clearly.

### Transcription Options

| Service                    | Cost          | Quality   | Diarization     | Real-time       | Free Tier              |
| -------------------------- | ------------- | --------- | --------------- | --------------- | ---------------------- |
| **Deepgram Nova-3**        | $0.46/hr      | Excellent | Yes (+$0.12/hr) | Yes (streaming) | $200 credit (~430 hrs) |
| **AssemblyAI**             | $0.15-0.45/hr | Excellent | Yes (+$0.02/hr) | Yes (streaming) | $50 credit             |
| **OpenAI Whisper API**     | $0.36/hr      | Very good | No              | No (batch only) | None                   |
| **Browser Whisper (WASM)** | Free          | Good      | No              | Near-real-time  | N/A                    |
| **Web Speech API**         | Free          | Moderate  | No              | Yes             | N/A (Chrome only)      |

**Recommendation: Deepgram Nova-3**

- $200 free credit = ~430 hours of meetings (months of usage before paying anything)
- Streaming via WebSocket = live transcript during the meeting
- Speaker diarization built-in = identifies who said what
- $0.58/hr all-in (audio + diarization) once free credits run out
- True per-second billing (silence isn't charged)

### Architecture

```
┌─────────────────────────────────────────────────────┐
│  FractionalBuddy (Browser on P53)                   │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌────────────────┐  │
│  │ Tab Audio │ + │ Mic Audio│ → │ Web Audio Mix  │  │
│  │(getDisplay│   │(getUser  │   │ (AudioContext) │  │
│  │ Media)    │   │ Media)   │   └───────┬────────┘  │
│  └──────────┘   └──────────┘           │            │
│                                         │ MediaRecorder │
│                                         ▼            │
│  ┌──────────────────────────────────────────────┐   │
│  │  Recording UI Component                       │   │
│  │  • Start/Stop/Pause controls                  │   │
│  │  • Live waveform visualiser                   │   │
│  │  • Real-time transcript (scrolling)           │   │
│  │  • Speaker labels (from Deepgram diarization) │   │
│  │  • Duration timer                             │   │
│  └──────────────────┬───────────────────────────┘   │
│                      │ audio chunks (250ms)          │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐   │
│  │  Next.js API: /api/transcription/stream       │   │
│  │  • WebSocket proxy to Deepgram                │   │
│  │  • Keeps API key server-side                  │   │
│  │  • Returns transcript segments in real-time   │   │
│  └──────────────────┬───────────────────────────┘   │
│                      │ final transcript              │
│                      ▼                               │
│  ┌──────────────────────────────────────────────┐   │
│  │  Existing Pipeline                            │   │
│  │  • Claude/Gemini structured extraction        │   │
│  │  • Create meeting + tasks + timesheet         │   │
│  │  • Store transcript + audio file              │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Features to Build

1. **Recording Controls Component** — Start, stop, pause button in a floating bar or sidebar panel. Waveform visualiser showing audio levels. Duration counter.
2. **Audio Capture Service** — `getUserMedia` + `getDisplayMedia` mixing. MediaRecorder outputting WebM chunks. Error handling for permission denial and browser compatibility.
3. **Transcription WebSocket Proxy** — Next.js API route that proxies audio to Deepgram. Returns real-time transcript segments. Keeps Deepgram API key server-side.
4. **Live Transcript Panel** — Scrolling transcript during recording. Speaker labels from Deepgram diarization. Editable after recording ends (fix names, correct words).
5. **Post-Recording Processing** — Feed final transcript into existing Claude pipeline. Auto-create meeting record with transcript, summary, tasks, timesheet entry. Save audio file to storage (Supabase Storage or local).
6. **Upload Existing Recordings** — Keep existing .txt transcript upload. Add audio/video file upload → Deepgram batch transcription → same pipeline.

### Browser Compatibility

| Feature                     | Chrome/Edge (P53) | Firefox  | Safari   |
| --------------------------- | ----------------- | -------- | -------- |
| Microphone capture          | Yes               | Yes      | Yes      |
| Tab audio capture           | Yes               | No       | No       |
| System audio (desktop apps) | Yes (Windows)     | No       | No       |
| MediaRecorder               | Yes               | Yes      | Yes      |
| Live transcription          | Yes               | Mic only | Mic only |

Since David uses Chrome/Edge on Windows (P53), full functionality is available. Firefox/Safari users would only get microphone capture (their own voice, not the meeting audio).

### Estimated Effort

4-5 kanban prompts:

1. Audio capture service + recording UI component
2. Deepgram WebSocket proxy + real-time transcript display
3. Post-recording processing (connect to existing Claude pipeline)
4. Audio/video file upload + batch transcription
5. Polish: waveform visualiser, speaker name editing, audio playback with timestamp sync

---

## 2. Google Drive Integration (Multiple Accounts)

### The Goal

Connect one or more Google Drive accounts per CRM customer. Show files from those folders in FractionalBuddy. Detect new/changed files. Optionally ingest file contents for the future RAG feature.

### How It Works

**Single Google Cloud project** with one OAuth consent screen covering Drive + Calendar + Gmail (incremental authorisation — request scopes as needed).

**OAuth2 flow:**

1. User clicks "Connect Google Drive" in FractionalBuddy
2. Redirects to Google consent screen requesting `drive.readonly` scope
3. Google redirects back with auth code
4. Server exchanges code for access_token + refresh_token
5. Refresh token stored (encrypted) in Supabase
6. Access token auto-refreshed when expired (1-hour lifetime)

**Multiple accounts:**

- Each CRM customer can link to a different Google Drive folder/account
- Store connections in a new `integrations` table
- UI: "Connect Google Drive" button on each CRM customer page

### Key API Operations

| Operation            | Endpoint                                      | Use Case                      |
| -------------------- | --------------------------------------------- | ----------------------------- |
| List files in folder | `GET /drive/v3/files?q='folderId' in parents` | Show customer's shared folder |
| Get file metadata    | `GET /drive/v3/files/{id}`                    | Show file details             |
| Download file        | `GET /drive/v3/files/{id}?alt=media`          | For RAG ingestion later       |
| Export Google Doc    | `GET /drive/v3/files/{id}/export`             | Convert to PDF/text           |
| Watch for changes    | `POST /drive/v3/changes/watch`                | New file notifications        |

### Architecture

```
┌───────────────────────────────────────────────────┐
│  FractionalBuddy                                   │
│                                                     │
│  CRM Customer Page → "Google Drive" tab            │
│  ┌─────────────────────────────────────────────┐   │
│  │  📁 LoveSac Shared Folder                   │   │
│  │  ├── solution-design.docx    (3 days ago)   │   │
│  │  ├── requirements.pdf        (1 week ago)   │   │
│  │  ├── architecture.png        (2 weeks ago)  │   │
│  │  └── + 12 more files                        │   │
│  │                                              │   │
│  │  [Open in Drive] [Refresh] [Sync Status: ✓] │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Settings → Integrations                           │
│  ┌─────────────────────────────────────────────┐   │
│  │  Google Accounts                             │   │
│  │  • david@gwth.ai          [Drive ✓] [Cal ✓] │   │
│  │  • david@conscia.io       [Drive ✓]         │   │
│  │  [+ Connect Google Account]                  │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  /api/auth/google/callback                         │
│  /api/integrations/google/drive/files              │
│  /api/webhooks/google/drive (change notifications) │
└───────────────────────────────────────────────────┘
```

### Database Changes

```sql
-- Store OAuth connections
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  provider text NOT NULL,  -- 'google', 'slack'
  account_identifier text, -- email address or workspace name
  access_token text,       -- encrypted
  refresh_token text,      -- encrypted
  token_expires_at timestamptz,
  scopes text[],
  metadata jsonb,          -- provider-specific data
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Link CRM customers to Drive folders
CREATE TABLE crm_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id uuid REFERENCES crm_customers(id),
  integration_id uuid REFERENCES integrations(id),
  folder_id text NOT NULL,   -- Google Drive folder ID
  folder_name text,
  last_synced_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Cache file metadata locally
CREATE TABLE drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_drive_folder_id uuid REFERENCES crm_drive_folders(id),
  google_file_id text NOT NULL,
  name text,
  mime_type text,
  size_bytes bigint,
  modified_at timestamptz,
  web_view_link text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Sync Strategy

**MVP: Polling (simpler)**

- Cron job every 15 minutes: check each linked folder for changes
- Use `changes.list` with stored page token for incremental updates
- Update local file cache
- Supabase Edge Function or Next.js API route triggered by Vercel Cron

**Later: Webhooks (real-time)**

- `changes.watch` sends push notifications to `/api/webhooks/google/drive`
- Channels expire every 24 hours — cron to renew
- Requires public HTTPS URL (works once deployed to Hetzner)

### Google OAuth Verification

**Important process note:**

- Apps with <100 users can stay in "Testing" mode, but tokens expire every 7 days
- Production apps need Google verification: privacy policy URL, homepage, scope justification
- Drive + Calendar scopes: standard verification (1-2 weeks)
- Gmail scopes: may require CASA security assessment ($15-75K) if using broad scopes — use `gmail.metadata` to avoid this
- **Recommendation:** Start in Testing mode for development. Submit for verification when ready to deploy. Use `drive.readonly` + `calendar.readonly` initially (standard verification, no security assessment needed).

### Cost

- Google Drive API: **Free** (no per-call charges)
- Google Cloud project: **Free** (OAuth only, no infrastructure)
- Pub/Sub (if using webhooks later): **Free tier** covers this easily

### npm Package

- `googleapis` — single package covers Drive, Calendar, Gmail

### Estimated Effort

3-4 kanban prompts:

1. Google OAuth2 flow + integrations table + token storage
2. Drive file listing + CRM customer folder linking
3. File browser UI component on CRM detail page
4. Sync (polling cron) + change detection

---

## 3. Slack Integration

### The Goal

Connect to Slack workspaces where David works with clients. Surface relevant messages in FractionalBuddy. Post updates from FractionalBuddy to Slack. Search message history for context.

### How It Works

**Slack App** created at api.slack.com with:

- **Bot Token** (`xoxb-`) — posts messages, reads channels the bot is invited to
- **User Token** (`xoxp-`) — searches all messages (search.messages requires user token)
- **Events API** — receives real-time message notifications via webhook

**OAuth flow:**

1. User clicks "Connect Slack" in FractionalBuddy Settings
2. Redirects to Slack OAuth with requested scopes
3. Slack redirects back with auth code
4. Exchange for bot_token + user_token (if requested)
5. Store tokens in `integrations` table (same as Google)

### Features to Build

| Feature                                             | Token Needed     | Complexity |
| --------------------------------------------------- | ---------------- | ---------- |
| Post meeting summaries to a Slack channel           | Bot              | Simple     |
| Post task updates to Slack                          | Bot              | Simple     |
| Search Slack history for client context             | User             | Medium     |
| Receive messages mentioning the bot                 | Bot + Events API | Medium     |
| Show recent Slack messages on CRM customer page     | User             | Medium     |
| Create tasks from Slack messages (react with emoji) | Bot + Events API | Medium     |

### Architecture

```
┌───────────────────────────────────────────────────┐
│  FractionalBuddy                                   │
│                                                     │
│  Settings → Integrations → Slack                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Workspace: Conscia      [Connected ✓]      │   │
│  │  Channels mapped:                            │   │
│  │    #lovesac-project → CRM: LoveSac          │   │
│  │    #general          → (unmapped)            │   │
│  │  [+ Map Channel to Customer]                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  CRM Customer Page → "Slack" tab                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Recent messages in #lovesac-project         │   │
│  │  • Sana: "the BOM path needs clarifying"    │   │
│  │  • David: "agreed, adding to kickoff agenda" │   │
│  │  [Open in Slack] [Search this channel]       │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  /api/auth/slack/callback                          │
│  /api/webhooks/slack/events                        │
│  /api/integrations/slack/search                    │
│  /api/integrations/slack/post                      │
└───────────────────────────────────────────────────┘
```

### Database Changes

```sql
-- Map Slack channels to CRM customers
CREATE TABLE slack_channel_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id),
  channel_id text NOT NULL,
  channel_name text,
  crm_customer_id uuid REFERENCES crm_customers(id),
  created_at timestamptz DEFAULT now()
);
```

### Key Considerations

- **Free Slack workspaces** only expose 90 days of message history via API
- **Rate limits:** 1 message/second for posting, 50/minute for search
- **No App Directory listing needed** — use direct install URLs for David's workspaces
- **Socket Mode** (WebSocket, no public URL) works for development; Events API (webhook) for production

### npm Package

- `@slack/bolt` — all-in-one: OAuth, events, interactions, commands

### Cost

- Slack API: **Free** (no per-call charges)

### Estimated Effort

3-4 kanban prompts:

1. Slack App setup + OAuth flow + token storage in integrations table
2. Channel mapping UI + message fetching + display on CRM page
3. Post meeting summaries / task updates to Slack
4. Search + event handling (message reactions → tasks)

---

## 4. Google Calendar Sync

### The Goal

Show David's calendar in FractionalBuddy. Auto-detect meetings with clients. Pre-fill meeting records. Show upcoming availability.

### How It Works

Uses the **same Google OAuth** from the Drive integration — just adds the `calendar.readonly` scope via incremental authorisation. No separate auth flow needed.

### Features to Build

| Feature                                                                 | Complexity |
| ----------------------------------------------------------------------- | ---------- |
| Show upcoming events on Dashboard                                       | Simple     |
| Auto-link calendar events to CRM customers (by attendee email matching) | Medium     |
| Pre-create meeting records from calendar events                         | Medium     |
| Calendar page (currently placeholder)                                   | Simple     |
| Free/busy view for scheduling                                           | Simple     |

### Architecture

```
┌───────────────────────────────────────────────────┐
│  FractionalBuddy                                   │
│                                                     │
│  Dashboard → "Upcoming" card                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  Today                                       │   │
│  │  10:00 - LoveSac Kickoff (Google Meet)      │   │
│  │  14:00 - Conscia Standup (Teams)            │   │
│  │                                              │   │
│  │  Tomorrow                                    │   │
│  │  09:30 - Architecture Review (Zoom)         │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Calendar Page (replace placeholder)               │
│  ┌─────────────────────────────────────────────┐   │
│  │  Week view with events                       │   │
│  │  Click event → Pre-fill meeting form         │   │
│  │  Events auto-tagged by CRM customer          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  /api/integrations/google/calendar/events          │
│  Cron: sync events every 15 minutes               │
└───────────────────────────────────────────────────┘
```

### Sync Strategy

- **Sync tokens**: First fetch gets all events in range + a `nextSyncToken`. Subsequent syncs use the token to get only changes. Very efficient.
- Store events in a local `calendar_events` table for fast rendering
- Match attendee emails to contacts table for automatic CRM customer linking
- Cron every 15 minutes (or webhook for real-time)

### Database Changes

```sql
CREATE TABLE calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES integrations(id),
  google_event_id text NOT NULL,
  title text,
  description text,
  start_time timestamptz,
  end_time timestamptz,
  location text,
  meeting_url text,        -- Zoom/Meet/Teams link
  attendees jsonb,         -- [{email, name, response_status}]
  crm_customer_id uuid REFERENCES crm_customers(id), -- auto-matched
  meeting_id uuid REFERENCES meetings(id),            -- linked after meeting created
  status text,             -- confirmed, tentative, cancelled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Cost

- Google Calendar API: **Free**

### Estimated Effort

2-3 kanban prompts:

1. Calendar event sync + storage (uses existing Google OAuth)
2. Calendar page UI (replace placeholder) + dashboard upcoming card
3. Auto-link events to CRM customers + pre-fill meeting forms

---

## 5. Email Integration (Gmail)

### The Goal

Show email threads related to each CRM customer. Send follow-ups from FractionalBuddy. Track email activity in the engagement timeline.

### How It Works

Same Google OAuth — adds `gmail.readonly` (and optionally `gmail.send`) scope.

### Features to Build

| Feature                                                         | Complexity |
| --------------------------------------------------------------- | ---------- |
| Show recent emails per CRM customer (by attendee/contact email) | Medium     |
| Email search within customer context                            | Medium     |
| Send email from FractionalBuddy (compose + send)                | Medium     |
| Push notifications for new emails from client contacts          | Complex    |

### Key Considerations

**Privacy/Verification:**

- `gmail.readonly` requires Google's standard verification (1-2 weeks)
- `gmail.send` adds the "send email on your behalf" scope — more scrutiny
- `mail.google.com` (full access) requires CASA Tier 2 security assessment — **avoid** ($15-75K)
- **Recommendation:** Start with `gmail.metadata` only (subject, from, date, no body). Upgrade to `gmail.readonly` after verification.

**Push Notifications:**

- Gmail uses Google Cloud Pub/Sub (not direct webhooks)
- Requires setting up a Pub/Sub topic + subscription
- More infrastructure than Drive/Calendar webhooks
- **MVP alternative:** Polling via cron every 15 minutes

**Email Parsing:**

- Gmail API returns MIME-encoded messages — parsing multi-part emails is tedious
- Use a library like `mailparser` for reliable extraction

### Architecture

```
┌───────────────────────────────────────────────────┐
│  FractionalBuddy                                   │
│                                                     │
│  CRM Customer Page → "Email" tab                   │
│  ┌─────────────────────────────────────────────┐   │
│  │  Recent emails with LoveSac contacts         │   │
│  │  • From: sana@conscia.io — "Re: Kickoff..."  │   │
│  │  • To: david@gwth.ai — "Architecture Q..."   │   │
│  │  [Compose] [Search Emails]                   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  /api/integrations/google/gmail/messages           │
│  /api/integrations/google/gmail/send               │
│  /api/webhooks/google/gmail (Pub/Sub push)         │
└───────────────────────────────────────────────────┘
```

### Cost

- Gmail API: **Free**
- Pub/Sub: **Free tier** (10GB/mo)

### Estimated Effort

3-4 kanban prompts:

1. Gmail scope addition + email listing per customer (metadata only initially)
2. Email detail view + search
3. Compose + send email from FractionalBuddy
4. Push notifications via Pub/Sub (or polling cron)

---

## 6. RAG Document Q&A

### The Goal

Upload project documents and ask questions across them. "What did the solution design say about BOM explosion?" — answered instantly from embedded documents.

### How It Works

Documents are chunked → embedded → stored in a vector database. When a user asks a question, the query is embedded and similar chunks are retrieved → fed to an LLM as context → answer generated.

### Architecture: Qdrant (Standardised Across All Projects)

All David's projects use the same stack: **Qdrant** for vector storage + **Qwen3-Embedding-8B** via Ollama for embeddings. FractionalBuddy gets its own Qdrant instance (embedded mode, file-based) separate from GWTH's instance but using the same model, dimensions, and distance metric.

| Setting         | Value                         | Shared With   |
| --------------- | ----------------------------- | ------------- |
| Vector DB       | Qdrant (embedded mode)        | GWTH Pipeline |
| Embedding model | Qwen3-Embedding-8B Q4_K_M     | GWTH Pipeline |
| Dimensions      | 4096                          | GWTH Pipeline |
| Distance metric | Cosine                        | GWTH Pipeline |
| Ollama endpoint | `http://192.168.178.50:11434` | GWTH Pipeline |

**Why Qdrant over pgvector:** Standardisation. GWTH already uses Qdrant. Qdrant embedded mode has zero infrastructure overhead (file-based, same as SQLite). Qdrant also supports hybrid search (dense + sparse vectors) which pgvector doesn't. Same Qdrant client library works in both Python and TypeScript.

### Features to Build

| Feature                                                | Complexity |
| ------------------------------------------------------ | ---------- |
| Document embedding pipeline (chunk + embed on upload)  | Medium     |
| "Ask about [Customer]" chat interface                  | Medium     |
| Auto-embed meeting transcripts                         | Simple     |
| Auto-embed Drive files (connects to Drive integration) | Medium     |
| Search across all documents                            | Simple     |

### Qdrant Collection Setup (FractionalBuddy)

```typescript
// Using @qdrant/js-client-rest
import { QdrantClient } from "@qdrant/js-client-rest";

const qdrant = new QdrantClient({ path: "./data/qdrant" }); // embedded mode

await qdrant.createCollection("fractionalbuddy_docs", {
  vectors: {
    size: 4096, // Qwen3-Embedding-8B dimensions
    distance: "Cosine",
  },
});
```

**Metadata per chunk (payload):**

```json
{
  "source_type": "asset|meeting|drive_file|note",
  "source_id": "uuid",
  "crm_customer_id": "uuid",
  "chunk_index": 0,
  "content": "chunk text...",
  "file_name": "source.pdf",
  "ingested_at": "2026-04-01T12:00:00Z"
}
```

### Embedding Model — Shared with GWTH Pipeline (GPU-Accelerated)

The GWTH pipeline currently uses `sentence-transformers/all-MiniLM-L6-v2` (384-D, 22M params, MTEB 56.3). This is the smallest viable model — upgrading it would dramatically improve RAG quality across both projects. With dual GPUs on P520, we can run much bigger models.

**Current GWTH RAG setup:**

- Model: `all-MiniLM-L6-v2` (384 dimensions)
- Vector DB: Embedded Qdrant (file-based, `/data/qdrant_data/`)
- Collection: `gwth_lessons`
- Chunking: 500 chars, 50 char overlap, paragraph-aware
- Retrieval: Cosine similarity + freshness tiebreaker + source filtering
- Library: `sentence-transformers==3.2.1`, `qdrant-client==1.11.1`

#### P520 GPU Hardware

| GPU          | VRAM  | Bandwidth | CUDA Cores | Current Usage                          |
| ------------ | ----- | --------- | ---------- | -------------------------------------- |
| **RTX 3060** | 12 GB | 360 GB/s  | 3,584      | VibeVoice 1.5B (~7GB), Qdrant (~208MB) |
| **RTX 3090** | 24 GB | 936 GB/s  | 10,496     | Kokoro (~960MB), F5-TTS (~1GB)         |

Both GPUs are **heavily underutilised**. The 3090 has ~22 GB free most of the time. The 3060 has ~5 GB free when VibeVoice 1.5B is loaded, or 12 GB free when it's not. VibeVoice 7B (~18.7 GB) occasionally uses the 3090 but only during active TTS generation.

#### Embedding Model Options (GPU-Accelerated)

| Model                          | Params | MTEB      | Dims | Context | VRAM (FP16) | VRAM (Q4) | License    |
| ------------------------------ | ------ | --------- | ---- | ------- | ----------- | --------- | ---------- |
| **all-MiniLM-L6-v2** (current) | 22M    | 56.3      | 384  | 512 tok | 0.1 GB      | N/A       | Apache 2.0 |
| **Nomic Embed Text v1.5**      | 137M   | ~62       | 768  | 8K tok  | 0.5 GB      | 0.3 GB    | Apache 2.0 |
| **BGE-M3**                     | 568M   | 63.0      | 1024 | 8K tok  | 1.1 GB      | 0.5 GB    | MIT        |
| **Qwen3-Embedding-8B**         | 8B     | **70.58** | 4096 | 32K tok | 17 GB       | **~5 GB** | Apache 2.0 |

#### Recommendation: Qwen3-Embedding-8B (Q4_K_M) on RTX 3060

This is the **highest-quality open embedding model available** (MTEB 70.58 — beats all closed-source models including OpenAI's text-embedding-3-large). At Q4 quantisation it uses ~5 GB VRAM, fitting comfortably on the RTX 3060.

**Why Qwen3-Embedding-8B:**

- **14 MTEB points better** than current model (56.3 → 70.58) — transformative quality improvement
- 32K token context — can embed entire documents, not just small chunks
- Q4_K_M quantisation: ~5 GB VRAM — fits on RTX 3060 with 7 GB headroom
- Available via `ollama pull qwen3-embedding:8b` (official Ollama model)
- Apache 2.0 license — fully open

**Can it coexist with TTS? Yes — no swapping needed:**

| GPU                  | Resident Models                 | VRAM Used | VRAM Free |
| -------------------- | ------------------------------- | --------- | --------- |
| **RTX 3060 (12 GB)** | Qwen3-Embedding-8B Q4 (~5 GB)   | ~5 GB     | ~7 GB     |
| **RTX 3090 (24 GB)** | Kokoro (~1 GB) + F5-TTS (~1 GB) | ~2 GB     | ~22 GB    |

When VibeVoice 7B runs (rare, ~18.7 GB on 3090), it temporarily takes the 3090. Embeddings on the 3060 are unaffected. When VibeVoice 1.5B runs on the 3060 (~7 GB), embedding + VV1.5B = ~12 GB — tight but fits. Ollama's `OLLAMA_KEEP_ALIVE` can auto-unload the embedding model after idle time if needed.

**Fallback option if Qwen3 is too large:** BGE-M3 (568M, MTEB 63.0, 1024-D, ~1 GB VRAM). Still a huge upgrade over MiniLM, and leaves massive headroom on either GPU.

#### GPU Isolation Strategy

Ollama doesn't support per-model GPU pinning natively. The solution is **two Ollama instances**:

```
# Instance 1: Embeddings on RTX 3060 (GPU 0), port 11434
CUDA_VISIBLE_DEVICES=0 OLLAMA_HOST=0.0.0.0:11434 ollama serve

# Instance 2: Future LLM on RTX 3090 (GPU 1), port 11435
CUDA_VISIBLE_DEVICES=1 OLLAMA_HOST=0.0.0.0:11435 ollama serve
```

TTS services (Kokoro, F5-TTS, VibeVoice) already run as separate Docker containers with their own CUDA device assignment — no conflict.

#### Migration Path

1. Install Ollama on P520: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull model: `ollama pull qwen3-embedding:8b`
3. Set up as systemd service with `CUDA_VISIBLE_DEVICES=0` (pin to 3060)
4. GWTH: Update `qdrant_service.py` to use Ollama API instead of sentence-transformers
5. Re-embed existing GWTH documents (one-time batch job)
6. FractionalBuddy: Use same Ollama endpoint for embedding documents
7. Vector dimensions change: 384 → 4096 (requires new Qdrant collection or pgvector column)
8. Remove `sentence-transformers` from GWTH requirements.txt (saves ~500MB of deps)

#### Vector Database: Stick with Qdrant

**GPUs don't change the vector DB recommendation.** GPU-accelerated vector search (Milvus/FAISS) only matters at 100M+ vectors with thousands of QPS. At your scale (<100K vectors), CPU-based HNSW search completes in <3ms. Your GPUs are far better spent on embedding models and LLM inference.

| Vector DB            | GPU Search?   | Setup Complexity             | Your Scale Performance            | Verdict                      |
| -------------------- | ------------- | ---------------------------- | --------------------------------- | ---------------------------- |
| **Qdrant** (current) | No (CPU SIMD) | Easy (embedded mode)         | <1ms at 100K vectors              | **Keep it**                  |
| Milvus               | Yes (CUDA)    | Complex (4+ containers)      | Overkill, adds latency            | Skip                         |
| ChromaDB             | No            | Easy                         | Weaker at scale                   | Skip                         |
| Weaviate             | No            | Moderate                     | Comparable to Qdrant              | No reason to switch          |
| pgvector             | No            | Zero (Supabase)              | Adequate, less features           | Use for FractionalBuddy only |
| FAISS                | Yes (CUDA)    | Library only, no DB features | Fast but no persistence/filtering | Skip                         |

**Architecture:** GWTH stays on Qdrant (embedded). FractionalBuddy uses pgvector in Supabase (zero infrastructure, vectors alongside relational data). Both share the same Ollama embedding model, producing identical vectors. If FractionalBuddy's pgvector needs outgrow Supabase, migrating to Qdrant is straightforward (same vectors, same dimensions).

### Estimated Effort

2-3 kanban prompts:

1. Embedding pipeline + pgvector setup + document chunking
2. Chat UI component with RAG retrieval
3. Auto-embed meetings + Drive files + integration with asset uploads

---

## Shared Infrastructure: Integrations Table + Settings Page

All integrations share common infrastructure that should be built first:

### New Page: Settings → Integrations

```
/settings/integrations
┌─────────────────────────────────────────────────┐
│  Connected Accounts                              │
│                                                   │
│  Google                                          │
│  ┌───────────────────────────────────────────┐   │
│  │ david@gwth.ai      Drive ✓  Cal ✓  Gmail │   │
│  │ david@conscia.io   Drive ✓               │   │
│  │ [+ Connect Google Account]                │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  Slack                                           │
│  ┌───────────────────────────────────────────┐   │
│  │ Conscia Workspace   [Connected ✓]         │   │
│  │ [+ Connect Slack Workspace]               │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  Transcription                                   │
│  ┌───────────────────────────────────────────┐   │
│  │ Deepgram            [API Key Set ✓]       │   │
│  │ Credit remaining: $187.42                 │   │
│  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Database Migration (Shared)

```sql
-- Core integrations table (used by all providers)
CREATE TABLE integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES clients(id),
  user_id uuid REFERENCES auth.users(id),
  provider text NOT NULL,           -- 'google', 'slack', 'deepgram'
  account_identifier text,          -- email, workspace name, etc.
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  scopes text[],
  metadata jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Estimated Effort

1 kanban prompt for shared infra (integrations table + settings page skeleton + Google OAuth flow)

---

## Implementation Roadmap

### Phase 1: Foundation + Meeting Recording (Weeks 1-3)

| Prompt | Description                                                     |
| ------ | --------------------------------------------------------------- |
| 1      | Integrations table + Settings page + token encryption           |
| 2      | Deepgram account setup + API route for transcription            |
| 3      | Audio capture component (getUserMedia + getDisplayMedia)        |
| 4      | Recording UI (controls, waveform, live transcript)              |
| 5      | Post-recording pipeline (connect to existing Claude extraction) |
| 6      | Audio file upload + batch transcription fallback                |

### Phase 2: Google Drive (Weeks 3-5)

| Prompt | Description                                                  |
| ------ | ------------------------------------------------------------ |
| 7      | Google OAuth2 flow (consent screen, callback, token storage) |
| 8      | Drive file listing API + CRM folder linking                  |
| 9      | Drive file browser component on CRM detail page              |
| 10     | Sync cron (polling) + change detection                       |

### Phase 3: Slack (Weeks 5-7)

| Prompt | Description                                     |
| ------ | ----------------------------------------------- |
| 11     | Slack App creation + OAuth flow + token storage |
| 12     | Channel mapping + message display on CRM page   |
| 13     | Post meeting summaries + task updates to Slack  |
| 14     | Slack search + event-driven task creation       |

### Phase 4: Google Calendar (Weeks 7-8)

| Prompt | Description                                                   |
| ------ | ------------------------------------------------------------- |
| 15     | Calendar event sync (incremental, uses existing Google OAuth) |
| 16     | Calendar page UI + dashboard upcoming card                    |
| 17     | Auto-link events to customers + pre-fill meeting forms        |

### Phase 5: Email (Weeks 8-10)

| Prompt | Description                              |
| ------ | ---------------------------------------- |
| 18     | Gmail scope + email listing per customer |
| 19     | Email detail view + search               |
| 20     | Compose + send                           |
| 21     | Push notifications (Pub/Sub or polling)  |

### Phase 6: RAG (Weeks 10-12)

| Prompt | Description                                             |
| ------ | ------------------------------------------------------- |
| 22     | pgvector setup + embedding pipeline + document chunking |
| 23     | "Ask about [Customer]" chat UI with retrieval           |
| 24     | Auto-embed meetings + Drive files + assets              |

**Total: ~24 prompts across ~12 weeks**

---

## External Account Setup Required (Before Development)

| Service                  | Action                                                                           | Cost                   | Time   |
| ------------------------ | -------------------------------------------------------------------------------- | ---------------------- | ------ |
| **Anthropic Console**    | Sign up, add payment method, generate API key                                    | Pay-as-you-go (~$5/mo) | 5 min  |
| **Deepgram**             | Sign up at deepgram.com, get API key                                             | Free ($200 credit)     | 5 min  |
| **Google Cloud Console** | Create project, enable Drive+Calendar+Gmail APIs, configure OAuth consent screen | Free                   | 30 min |
| **Slack API**            | Create app at api.slack.com, configure scopes + event subscriptions              | Free                   | 20 min |
| **Ollama on P520**       | Install Ollama, pull nomic-embed-text                                            | Free                   | 10 min |

---

## Risk Register

| Risk                                          | Impact                                    | Likelihood | Mitigation                                                                                                          |
| --------------------------------------------- | ----------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------- |
| Google OAuth verification takes weeks         | Blocks Drive/Cal/Gmail integrations       | High       | Start verification process immediately. Use Testing mode for development (7-day token expiry acceptable during dev) |
| getDisplayMedia audio checkbox missed by user | No meeting audio captured                 | Medium     | Clear UX guidance, audio level indicator shows silence, prompt to retry                                             |
| Deepgram free credits exhausted               | Costs begin ($0.58/hr)                    | Low        | $200 = 430 hours. At 10 hrs/week meetings, lasts ~10 months                                                         |
| Gmail security assessment triggered           | Blocks Gmail integration or costs $15-75K | Medium     | Use `gmail.metadata` scope only (no body content). Avoids CASA assessment entirely                                  |
| Browser compatibility (Firefox/Safari)        | Tab audio capture fails                   | Low        | Primary user (David) uses Chrome on Windows. Degrade gracefully for other browsers                                  |
| Slack free workspace 90-day limit             | Historical messages unavailable           | Medium     | Document limitation. Most value is in recent messages anyway                                                        |

---

## Decision Points for David

1. **LLM for transcript processing** — With the hybrid architecture (see Appendix C), FractionalBuddy can use `claude -p` (Max subscription, free) for transcript processing instead of the Anthropic API. This eliminates the need for a separate API key. Alternatively, keep the Gemini key you already have for simpler extraction tasks. Decision: Claude via CLI (free with Max) or Gemini API (free tier)?

2. **Gmail scope** — Start with metadata-only (`gmail.metadata` — subject, from, date, no body) to avoid security assessment? Or do you need email body content from day one?

3. **Calendar UI library** — Build custom week/month view, or use a library like `@fullcalendar/react`?

4. **Priority adjustment** — The plan assumes meeting recording is #1. If you'd rather get Google Drive connected first (simpler, no new service accounts), that could move ahead.

5. **GWTH embedding upgrade** — Upgrade GWTH pipeline from all-MiniLM-L6-v2 to Qwen3-Embedding-8B (Q4_K_M on RTX 3090). Requires re-embedding all existing documents (one-time job). Improves retrieval quality by ~14 MTEB points (56 → 70.58).

6. **VV7B as default TTS** — Switch from VV1.5B to VV7B as the primary TTS model with GPU queue (see Appendix D)? VV1.5B becomes fallback for when 3090 is busy with other work.

---

## Appendix A: GWTH Pipeline — RAG Improvement Plan

### Current State

The GWTH pipeline at `C:\Projects\1_gwthpipeline520` already has a working RAG system:

| Component           | Current                                                                 | Status                                  |
| ------------------- | ----------------------------------------------------------------------- | --------------------------------------- |
| Embedding model     | `all-MiniLM-L6-v2` (22M params, 384-D, MTEB 56.3)                       | Working but lowest-quality viable model |
| Vector DB           | Embedded Qdrant (file-based, cosine similarity)                         | Working well — **keep it**              |
| Chunking            | 500 chars, 50 overlap, paragraph-aware                                  | Too small for better models             |
| Retrieval           | Semantic search + freshness tiebreaker + source filtering + dedup       | Solid                                   |
| YouTube transcripts | `youtube-transcript-api` + auto-ingest to Qdrant                        | Fully working                           |
| Document processing | Docling (PDF/DOCX/HTML → Markdown + OCR)                                | Working                                 |
| Web scraping        | Crawl4AI (async, cached)                                                | Working                                 |
| Research pipeline   | Multi-source (RAG 40% + web 35% + transcripts 25%) with token budgeting | Working                                 |
| LLM generation      | **STUBBED** — placeholder for Claude API                                | Not yet implemented                     |

### P520 GPU VRAM Budget — Current vs Proposed

```
RTX 3060 (12 GB)                         RTX 3090 (24 GB)
┌────────────────────────────┐           ┌────────────────────────────┐
│ CURRENT                    │           │ CURRENT                    │
│ VibeVoice 1.5B    ~7.0 GB │           │ Kokoro TTS      ~1.0 GB   │
│ Qdrant             0.2 GB │           │ F5-TTS          ~1.0 GB   │
│ CUDA overhead      0.2 GB │           │ CUDA overhead    0.2 GB   │
│ ─────────────────────────  │           │ ─────────────────────────  │
│ Used:    ~7.4 GB           │           │ Used:    ~2.2 GB           │
│ FREE:    ~4.6 GB           │           │ FREE:   ~21.8 GB           │
│                            │           │                            │
│ PROPOSED (add Ollama)      │           │ (VibeVoice 7B uses ~18.7   │
│ Qwen3-Embed Q4    ~5.0 GB │           │  GB when active — rare,    │
│ VibeVoice 1.5B    ~7.0 GB │           │  on-demand only)           │
│ ─────────────────────────  │           │                            │
│ Total:   ~12.0 GB (tight)  │           │                            │
│                            │           │ ALTERNATIVE: Put Qwen3     │
│ OR: Move VV1.5B to 3090   │           │ Embed here instead         │
│ Qwen3-Embed Q4    ~5.0 GB │           │ Qwen3-Embed Q4  ~5.0 GB   │
│ FREE:    ~7.0 GB           │           │ Kokoro + F5     ~2.0 GB   │
│                            │           │ Used:    ~7.0 GB           │
│                            │           │ FREE:   ~17.0 GB           │
└────────────────────────────┘           └────────────────────────────┘
```

**Recommended GPU allocation:** Put Qwen3-Embedding on the **RTX 3090** (port 11434). It has 22 GB free, and the 3090's 2.6x memory bandwidth means faster embedding throughput. TTS models (Kokoro 1 GB + F5-TTS 1 GB) coexist easily. When VibeVoice 7B runs (~18.7 GB), Ollama auto-unloads the embedding model (5 min idle timeout), VV7B generates, then the embedding model reloads. This is fine since VV7B runs rarely and embedding requests can queue briefly.

### Proposed Improvements

#### 1. Upgrade Embedding Model (HIGH Impact, Low Effort)

**Change:** Replace `all-MiniLM-L6-v2` with `Qwen3-Embedding-8B` (Q4_K_M) via Ollama on GPU

**Why:**

- MTEB 56.3 → 70.58 (**14-point improvement** — best open embedding model available)
- Context window 512 → 32K tokens (can embed entire documents)
- Current 500-char chunks may be truncating — this limit disappears entirely
- ~5 GB VRAM at Q4 quantisation — fits alongside TTS on 3090

**Files to modify:**

- `app/services/qdrant_service.py` — change embedding from sentence-transformers to Ollama HTTP API
- `app/config.py` — add `OLLAMA_BASE_URL`, `OLLAMA_EMBED_MODEL` settings
- One-time re-embedding script for existing `gwth_lessons` collection

**Migration steps:**

1. Install Ollama on P520: `curl -fsSL https://ollama.com/install.sh | sh`
2. Pull model: `ollama pull qwen3-embedding:8b`
3. Set up as systemd service:
   ```ini
   # /etc/systemd/system/ollama.service
   [Service]
   Environment="CUDA_VISIBLE_DEVICES=1"   # Pin to RTX 3090
   Environment="OLLAMA_HOST=0.0.0.0:11434"
   Environment="OLLAMA_KEEP_ALIVE=5m"
   ExecStart=/usr/local/bin/ollama serve
   ```
4. Update `qdrant_service.py`:

   ```python
   # Before (sentence-transformers — loads 500MB of deps, CPU-only)
   from sentence_transformers import SentenceTransformer
   model = SentenceTransformer('all-MiniLM-L6-v2')
   embeddings = model.encode(texts)

   # After (Ollama API — GPU-accelerated, 14 MTEB points better)
   import httpx
   resp = httpx.post("http://localhost:11434/api/embeddings", json={
       "model": "qwen3-embedding:8b",
       "prompt": text
   })
   embedding = resp.json()["embedding"]  # 4096-D vector
   ```

5. Create new Qdrant collection with 4096 dimensions (delete old, recreate)
6. Re-embed all documents (batch script — faster on GPU than old CPU approach)
7. Remove `sentence-transformers` from requirements.txt (saves ~500MB of deps)

**Estimated effort:** 1 kanban prompt

#### 2. Increase Chunk Size (Medium Impact, Low Effort)

**Change:** Increase from 500 chars to 2000-3000 chars with 300 char overlap

**Why:** With Qwen3's 32K token context, much larger chunks retain full paragraph context per retrieval hit. 500 chars ≈ 125 tokens — only 0.4% of the model's capacity. Research shows 512-1024 token chunks (2000-4000 chars) significantly outperform smaller ones.

**Risk:** Larger chunks = fewer results in the same token budget. The research pipeline's `MAX_RAG_CHARS` allocation handles this — reduce `RAG_RESULTS_PER_QUERY` from 5 to 3-4.

**Estimated effort:** Part of the embedding upgrade prompt

#### 3. Add Hybrid Retrieval — Dense + BM25 (Medium Impact, Medium Effort)

**Change:** Combine vector similarity search with keyword matching (BM25)

**Why:** Pure semantic search misses exact keyword matches. "What is Celigo?" might retrieve semantically similar but wrong passages. BM25 catches exact terms. Hybrid retrieval (weighted combination) outperforms either alone in benchmarks.

**Implementation:** Qdrant natively supports sparse vectors (since v1.7) — store both dense (Qwen3) and sparse (BM25-style) vectors per chunk. Query with both, Qdrant fuses results server-side. No external BM25 library needed.

**Estimated effort:** 1 kanban prompt

#### 4. YouTube Transcript Improvements (Low Impact, Already Working)

The GWTH pipeline already has a mature YouTube system:

- `youtube_transcript_service.py` — fetches transcripts via `youtube-transcript-api`
- `youtube_discovery_service.py` — RSS-based channel scanning + trending filters + relevance scoring
- Nightly orchestrator auto-scans channels, fetches transcripts, ingests to Qdrant
- `yt-dlp` service exists but marked as deprecated (replaced by transcript-api on 2026-03-24)

**What's working well:**

- Auto-punctuation for auto-generated captions
- Metadata extraction (channel name, date, video ID)
- Integration with Qdrant via the same chunking/embedding pipeline
- Discovery adoption workflow (scan → review → adopt → ingest)

**AnythingLLM comparison:** AnythingLLM's YouTube connector uses the same `youtube-transcript-api` library under the hood. Multiple open GitHub issues document failures (#1593, #4004). Your implementation is more robust with its RSS discovery + adoption workflow.

**Possible improvements:**

- Timestamp-aware retrieval (cite specific video timestamps in research output)
- Better deduplication if the same topic is covered in multiple videos

**No action needed** — YouTube ingestion is the most mature part of the pipeline.

---

## Appendix B: Shared Ollama + GPU Infrastructure

### Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  P520 (192.168.178.50) — Dual GPU                                │
│                                                                    │
│  RTX 3060 (GPU 0, 12 GB)              RTX 3090 (GPU 1, 24 GB)   │
│  ┌──────────────────────┐             ┌──────────────────────┐   │
│  │ VibeVoice 1.5B ~7 GB │             │ Ollama (port 11434)  │   │
│  │ (Docker container)    │             │ CUDA_VISIBLE_DEVICES=1│   │
│  │                       │             │                      │   │
│  │ Qdrant ~0.2 GB       │             │ Qwen3-Embed-8B Q4   │   │
│  │ (embedded, file-based)│             │   ~5 GB resident     │   │
│  │                       │             │                      │   │
│  │ Free: ~4.8 GB        │             │ Kokoro TTS ~1 GB    │   │
│  └──────────────────────┘             │ F5-TTS     ~1 GB    │   │
│                                        │                      │   │
│                                        │ Free: ~17 GB         │   │
│                                        │                      │   │
│                                        │ (VV7B ~18.7 GB when  │   │
│                                        │  active — Ollama     │   │
│                                        │  auto-unloads embed  │   │
│                                        │  model to make room) │   │
│                                        └───────────┬──────────┘   │
│                                                     │              │
│                              ┌──────────────────────┴──────┐      │
│                              │                             │      │
│                     ┌────────▼────────┐  ┌─────────────────▼──┐   │
│                     │ GWTH Pipeline   │  │ FractionalBuddy    │   │
│                     │ (Python)        │  │ (Next.js/TS)       │   │
│                     │                 │  │                    │   │
│                     │ POST localhost  │  │ POST 192.168...    │   │
│                     │  :11434/api/    │  │  :11434/api/       │   │
│                     │  embeddings    │  │  embeddings        │   │
│                     │                 │  │                    │   │
│                     │ → Qdrant       │  │ → Qdrant           │   │
│                     │   embedded     │  │   embedded         │   │
│                     │   4096-D       │  │   4096-D           │   │
│                     └─────────────────┘  └────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Ollama Embedding API (same for both projects)

```
POST http://192.168.178.50:11434/api/embeddings
{
  "model": "qwen3-embedding:8b",
  "prompt": "text to embed"
}
→ { "embedding": [0.123, -0.456, ...] }  // 4096 floats
```

### TypeScript Client (FractionalBuddy)

```typescript
const OLLAMA_URL = process.env.OLLAMA_URL || "http://192.168.178.50:11434";
const EMBED_MODEL = "qwen3-embedding:8b";

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });
  const { embedding } = await res.json();
  return embedding; // 4096-D vector
}
```

### Python Client (GWTH Pipeline)

```python
import httpx

OLLAMA_URL = "http://localhost:11434"
EMBED_MODEL = "qwen3-embedding:8b"

def embed(text: str) -> list[float]:
    resp = httpx.post(f"{OLLAMA_URL}/api/embeddings", json={
        "model": EMBED_MODEL,
        "prompt": text,
    })
    return resp.json()["embedding"]  # 4096-D vector
```

### Model Coexistence — With GPU Queue (See Appendix D)

With VV7B as the primary TTS model, the 3090 allocation changes. See Appendix D for the full GPU queue design.

| Scenario                  | GPU 0 (3060, 12 GB) | GPU 1 (3090, 24 GB)                                                                    | Queue Action                          |
| ------------------------- | ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------- |
| **Idle**                  | Qdrant (0.2 GB)     | Qwen3-Embed (5 GB) + Kokoro (1 GB)                                                     | Embed ready                           |
| **Embedding request**     | No change           | Qwen3-Embed serves (~50ms)                                                             | Instant                               |
| **VV7B TTS queued**       | No change           | Unload Qwen3-Embed → Load VV7B (18.7 GB) → Generate → Unload VV7B → Reload Qwen3-Embed | Queue waits, ~30s swap                |
| **Batch TTS (5 lessons)** | No change           | VV7B stays loaded, processes all 5, then swaps back                                    | Embed requests queue until batch done |
| **Phi-4-mini task**       | No change           | Load alongside Qwen3-Embed (5+3=8 GB)                                                  | Both fit, no swap                     |

### Systemd Service Setup

```ini
# /etc/systemd/system/ollama.service
[Unit]
Description=Ollama LLM Server (GPU 1 - RTX 3090)
After=network.target

[Service]
Environment="CUDA_VISIBLE_DEVICES=1"
Environment="OLLAMA_HOST=0.0.0.0:11434"
Environment="OLLAMA_KEEP_ALIVE=5m"
Environment="OLLAMA_MAX_LOADED_MODELS=3"
ExecStart=/usr/local/bin/ollama serve
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Both projects produce identical 4096-D vectors — documents embedded by either project are semantically compatible and could theoretically be cross-searched.

---

## Appendix C: Hybrid LLM Architecture — Local + Claude Max

### The Key Insight: Claude Code CLI Works with Max Subscription

`claude -p` (the Claude Code CLI in non-interactive mode) is **officially supported** with your Max subscription. It accepts prompts, returns structured JSON, and bills against your Max plan — not the API.

```bash
# Programmatic Claude access using your Max subscription
claude -p "Summarise this meeting transcript and extract tasks" \
  --output-format json \
  --max-turns 1 \
  < transcript.txt
```

This means FractionalBuddy and GWTH can call Claude for complex tasks **at zero additional cost** — no API key needed.

### Three-Tier LLM Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LLM Request Router (in-app logic or LiteLLM proxy)            │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐ │
│  │ Tier 1:     │  │ Tier 2:          │  │ Tier 3:            │ │
│  │ LOCAL FAST  │  │ LOCAL SMART      │  │ CLAUDE MAX         │ │
│  │             │  │                  │  │                    │ │
│  │ Phi-4-mini  │  │ Qwen3-8B or     │  │ claude -p          │ │
│  │ (3.8B, Q4)  │  │ Gemma3-12B      │  │ (Max subscription) │ │
│  │ ~3 GB VRAM  │  │ ~8 GB VRAM      │  │ Zero cost          │ │
│  │             │  │                  │  │                    │ │
│  │ Use for:    │  │ Use for:         │  │ Use for:           │ │
│  │ • Classify  │  │ • Summarise docs │  │ • Meeting analysis │ │
│  │ • Extract   │  │ • Draft emails   │  │ • Complex tasks    │ │
│  │ • Format    │  │ • Code review    │  │ • Multi-step plans │ │
│  │ • Route     │  │ • RAG answers    │  │ • Contract analysis│ │
│  │             │  │                  │  │                    │ │
│  │ Latency:    │  │ Latency:         │  │ Latency:           │ │
│  │ <1s         │  │ 2-5s             │  │ 5-30s              │ │
│  │ Cost: $0    │  │ Cost: $0         │  │ Cost: $0 (Max)     │ │
│  └──────┬──────┘  └────────┬─────────┘  └─────────┬──────────┘ │
│         │                  │                       │            │
│         └──────────────────┴───────────────────────┘            │
│                     All on RTX 3090 via Ollama                  │
│                     (except Claude = cloud)                     │
└─────────────────────────────────────────────────────────────────┘
```

### How It Works in Practice

**Tier 1 — Phi-4-mini (3.8B, ~3 GB VRAM)**
Fast classifier and simple task handler (HumanEval 74.4%). Handles:

- Classifying request complexity ("is this simple or complex?")
- Text formatting and extraction (parse dates, clean data)
- Simple code generation (boilerplate, schemas)
- Routing decisions ("does this need a bigger model?")
- ~80% of simple tasks at <1s latency

**Tier 2 — Qwen3-Coder-Next (80B MoE, 3B active, ~47 GB with RAM offload)**
Frontier-class coding model running locally (HumanEval 92.7%, SWE-Bench 70.6%). Handles:

- Complex coding tasks, multi-file edits
- Long-horizon reasoning and tool use
- RAG-augmented Q&A with deep analysis
- Code review and architectural decisions
- 20-25 t/s with GPU + RAM offload

**Tier 3 — Claude (via `claude -p`, Max subscription)**
Top-tier general reasoning. Handles:

- Meeting transcript analysis (complex multi-speaker extraction)
- Contract/engagement analysis
- Tasks requiring broad world knowledge
- Anything Tier 2 can't handle confidently
- 5-30s latency, zero additional cost

### VRAM Coexistence on RTX 3090

| Models Loaded                                                | VRAM      | Fits?                             |
| ------------------------------------------------------------ | --------- | --------------------------------- |
| Qwen3-Embed-8B Q4 (5 GB) + Phi-4-mini Q4 (3 GB)              | 8 GB      | Yes — 16 GB free                  |
| Qwen3-Embed-8B Q4 (5 GB) + Kokoro (1 GB) + Phi-4-mini (3 GB) | 9 GB      | Yes — 15 GB free                  |
| Qwen3-Coder-Next Q4 (24 GB GPU + ~23 GB RAM offload)         | 24 GB GPU | Yes — but everything else unloads |
| VV7B (18.7 GB)                                               | 18.7 GB   | Yes — everything else unloads     |

Ollama handles model swapping automatically. For a single user, the typical state is Qwen3-Embed + Phi-4-mini (8 GB total). Qwen3-Coder-Next and VV7B take over the full GPU when needed, then release it.

**Note on Qwen3-Coder-Next RAM offload:** The 80B model at Q4 is ~48 GB. Ollama loads as much as fits in VRAM (24 GB) and offloads the rest to system RAM. With 64 GB RAM on P520, this works at ~20-25 t/s generation speed — slower than pure GPU but very usable for coding tasks where you're reading the output anyway.

### Implementation for FractionalBuddy

```typescript
// src/lib/llm-router.ts
import { execSync } from "child_process";

const OLLAMA_URL = process.env.OLLAMA_URL || "http://192.168.178.50:11434";

type Tier = "fast" | "smart" | "claude";

async function route(prompt: string, tier: Tier = "smart"): Promise<string> {
  switch (tier) {
    case "fast":
      // Phi-4-mini via Ollama — simple tasks
      return ollamaChat("phi4-mini", prompt);
    case "smart":
      // Qwen3-8B via Ollama — medium tasks
      return ollamaChat("qwen3:8b", prompt);
    case "claude":
      // Claude via CLI — complex tasks (uses Max subscription)
      return claudeChat(prompt);
  }
}

async function ollamaChat(model: string, prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    body: JSON.stringify({ model, prompt, stream: false }),
  });
  return (await res.json()).response;
}

function claudeChat(prompt: string): string {
  // Uses Max subscription — zero API cost
  const result = execSync(
    `claude -p "${prompt.replace(/"/g, '\\"')}" --output-format json --max-turns 1`,
    { encoding: "utf-8", timeout: 60000 },
  );
  return JSON.parse(result).result;
}
```

### Qwen3.5 Embedding — No Upgrade Needed

**No Qwen3.5 embedding model exists.** The Qwen3.5 family (released Feb-Mar 2026) is entirely multimodal image-text models (0.8B to 397B). The Qwen3-Embedding series (June 2025) remains the latest.

**Verdict:** Qwen3-Embedding-8B remains the best open embedding model. Re-evaluate when a successor appears.

### Local Coding Model: Qwen3-Coder-Next (80B MoE, 3B active)

Qwen3-Coder-Next is a game-changer for local coding. 80B total params but only 3B active per token (MoE architecture). Apache 2.0.

**Benchmarks vs Phi-4-mini:**

| Benchmark          | Qwen3-Coder-Next (3B active) | Phi-4-mini (3.8B) |
| ------------------ | ---------------------------- | ----------------- |
| HumanEval          | **92.7%**                    | 74.4%             |
| SWE-Bench Verified | **70.6%**                    | N/A               |
| MMLU               | **82.5%**                    | ~70%              |

HumanEval 92.7% is frontier-class — comparable to GPT-4. SWE-Bench 70.6% means it can handle real-world multi-file coding tasks. Trained on 800K executable tasks with RL.

**The VRAM problem:** Despite only 3B active params, the full 80B model weights must be in memory:

| Quantization | Model Size | VRAM (4K ctx) | Fits on 3090?            |
| ------------ | ---------- | ------------- | ------------------------ |
| Q4_K_M       | 48.5 GB    | ~47 GB        | No (24 GB)               |
| Q3_K_M       | 38.3 GB    | ~37 GB        | No                       |
| UD-IQ2_M     | 25 GB      | ~28 GB        | No                       |
| UD-TQ1_0     | 18.9 GB    | ~22 GB        | Barely, no KV cache room |

**Can it work with GPU offloading?** Yes — with the 3090 (24 GB) + system RAM, Ollama/llama.cpp offloads inactive expert layers to RAM. Performance:

- Single 3090 + 64GB RAM: ~20-25 tokens/sec at Q4 (usable for coding agent)
- Dual 3090: ~33-71 tokens/sec (ideal but we only have one 3090)

**Revised three-tier local LLM:**

| Tier      | Model                      | Active Params   | VRAM               | Speed      | Use Case                               |
| --------- | -------------------------- | --------------- | ------------------ | ---------- | -------------------------------------- |
| 1 (Fast)  | Phi-4-mini Q4              | 3.8B            | 3 GB               | ~50 t/s    | Classify, extract, format, route       |
| 2 (Smart) | Qwen3-Coder-Next Q4        | 3B (of 80B MoE) | 24GB + RAM offload | ~20-25 t/s | Coding, multi-step reasoning, tool use |
| 3 (Best)  | Claude Max via `claude -p` | N/A             | Cloud              | ~30 t/s    | Complex analysis, meeting transcripts  |

Qwen3-Coder-Next replaces Qwen3-8B as Tier 2. With only 3B active params it's actually faster than a dense 8B model per token, despite needing more memory for the dormant experts. The coding quality jump (74% → 93% HumanEval) is massive.

**VRAM coexistence concern:** Qwen3-Coder-Next at Q4 needs ~47 GB — it won't fit alongside anything on the 3090. When it runs, the embedding model and TTS must unload. This is fine with the GPU queue (Appendix D) — Tier 2 tasks queue behind embeddings and TTS swaps back when done.

**Available on Ollama:** `ollama pull qwen3-coder-next` (52 GB Q4_K_M)

---

## Appendix D: GPU Task Queue — VV7B as Primary TTS

### The Problem

VV7B (18.7 GB) produces much better TTS than VV1.5B (7 GB), but it can't coexist with other models on the 3090 (only 24 GB total). Currently, VV7B runs on-demand and blocks everything else. With a proper queue, TTS jobs can run during idle time without disrupting embedding or other work.

### Design: Priority-Based GPU Queue

```
┌──────────────────────────────────────────────────────────────┐
│  GPU Task Queue (extends existing gpu_orchestrator.py)        │
│                                                                │
│  Priority Levels:                                             │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ P0 (IMMEDIATE): Embedding requests — <100ms, tiny    │    │
│  │ P1 (HIGH):      Interactive LLM (Phi-4-mini, 3 GB)   │    │
│  │ P1.5 (HIGH):    Coding LLM (Qwen3-Coder-Next, full)  │    │
│  │ P2 (NORMAL):    Single TTS generation (user-triggered)│    │
│  │ P3 (BACKGROUND): Batch TTS (nightly lesson pipeline)  │    │
│  │ P4 (IDLE):       Re-embedding, maintenance tasks      │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  Queue Behavior (single user):                                │
│  • P0 always served immediately (Qwen3-Embed stays loaded)   │
│  • P1 loads alongside Embed if space allows (5+3=8 GB fits)  │
│  • P2 triggers model swap: unload Embed → load VV7B →        │
│    generate → unload VV7B → reload Embed                     │
│  • P3 batches: load VV7B once, process all queued TTS,       │
│    then swap back (efficient for nightly pipeline)            │
│  • P4 runs only when nothing else is queued                  │
│  • Higher priority interrupts lower (P0 request during P3    │
│    batch = pause batch, serve embed, resume batch)            │
└──────────────────────────────────────────────────────────────┘
```

### RTX 3090 State Machine

```
                    ┌─────────────┐
          idle      │  EMBEDDING  │  Qwen3-Embed (5GB)
          ┌────────>│  + KOKORO   │  + Kokoro (1GB)
          │         │  + F5-TTS   │  + F5-TTS (1GB)
          │         │  = ~7 GB    │  = 17 GB free
          │         └──────┬──────┘
          │                │ VV7B TTS request (P2/P3)
          │                ▼
          │         ┌─────────────┐
          │         │  SWAPPING   │  Unload Embed (10s)
          │         │             │  Load VV7B (~20s)
          │         └──────┬──────┘
          │                │
          │                ▼
          │         ┌─────────────┐
  done /  │         │  TTS MODE   │  VV7B (18.7GB)
  timeout │         │             │  + Kokoro (1GB)
          └─────────│  = ~20 GB   │  F5-TTS unloaded
                    └─────────────┘
                           │
                    P0 embed request arrives?
                    → Queue it (VV7B finishes current
                      sentence, then swaps back)
```

### Implementation Approach

The GWTH pipeline already has `gpu_orchestrator.py` with priority-based eviction. The extension needed:

```python
# Extend gpu_orchestrator.py with:

class GPUTaskQueue:
    """Simple FIFO queue with priority levels for single-user GPU scheduling."""

    def __init__(self, orchestrator: GPUOrchestrator):
        self.orchestrator = orchestrator
        self.queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self.current_task: Optional[GPUTask] = None

    async def submit(self, task: GPUTask) -> asyncio.Future:
        """Submit a task. Returns a Future that resolves when done."""
        future = asyncio.get_event_loop().create_future()
        await self.queue.put((task.priority, task, future))
        return future

    async def worker(self):
        """Process tasks in priority order."""
        while True:
            priority, task, future = await self.queue.get()

            # Activate required GPU services
            await self.orchestrator.activate(task.service_name)

            # Run the task
            try:
                result = await task.execute()
                future.set_result(result)
            except Exception as e:
                future.set_exception(e)

            # If queue empty and service is expensive, schedule unload
            if self.queue.empty() and task.service_name == 'vibevoice_7b':
                asyncio.create_task(self._delayed_unload('vibevoice_7b', delay=60))
```

### Batch TTS Scheduling

For the nightly lesson pipeline, batch all TTS for a lesson into a single queue submission:

```python
# In nightly_orchestrator.py:
async def batch_tts_for_lesson(lesson_id: str, scripts: list[str]):
    """Queue all TTS for a lesson as one batch — VV7B loads once."""
    batch = GPUTask(
        service_name='vibevoice_7b',
        priority=Priority.BACKGROUND,  # P3
        work=lambda: generate_all_tts(lesson_id, scripts),
    )
    await gpu_queue.submit(batch)
```

### Estimated Effort

2 kanban prompts:

1. Extend `gpu_orchestrator.py` with task queue + priority levels + batch support
2. Wire up TTS router to use queue + update nightly orchestrator for batch TTS

---

## Appendix E: Updated P520 GPU Master Plan

### Complete Service Map (Post-Upgrade)

```
┌──────────────────────────────────────────────────────────────────────┐
│  P520 (192.168.178.50) — RTX 3060 (12GB) + RTX 3090 (24GB)         │
│                                                                       │
│  RTX 3060 (GPU 0)                  RTX 3090 (GPU 1)                  │
│  ┌──────────────────────┐         ┌──────────────────────────────┐   │
│  │ Qdrant       0.2 GB  │         │ Ollama Server (port 11434)   │   │
│  │ (GWTH embedded DB)   │         │ CUDA_VISIBLE_DEVICES=1       │   │
│  │                       │         │                              │   │
│  │ FREE: ~11.8 GB       │         │ RESIDENT:                    │   │
│  │ (VV1.5B removed —    │         │  Qwen3-Embed-8B Q4  5 GB    │   │
│  │  VV7B is now primary) │         │  Kokoro TTS          1 GB    │   │
│  │                       │         │  F5-TTS              1 GB    │   │
│  │ AVAILABLE FOR:        │         │  = 7 GB used, 17 GB free    │   │
│  │ • Future local LLM   │         │                              │   │
│  │ • Second Ollama inst  │         │ ON-DEMAND (via GPU queue):   │   │
│  │ • Docling OCR         │         │  Phi-4-mini Q4      +3 GB   │   │
│  │                       │         │  Qwen3-8B Q4        +5 GB   │   │
│  │                       │         │  VV7B               18.7 GB │   │
│  │                       │         │  (swaps out Embed + others)  │   │
│  └──────────────────────┘         └──────────────────────────────┘   │
│                                                                       │
│  Services (Docker containers on host):                                │
│  • kokoro-fastapi (port 8880) — GPU 1                                │
│  • f5-tts-1 (port 7860) — GPU 1                                     │
│  • vibevoice-7b (no port, docker exec) — GPU 1                      │
│  • dashboard (port 8088) — CPU + GPU 0 for Qdrant/Docling           │
│  • ollama (port 11434) — GPU 1 (systemd service)                    │
│                                                                       │
│  Queue Priority:                                                      │
│  P0: Embedding (instant, Qwen3-Embed stays loaded)                   │
│  P1: Interactive LLM (Phi-4-mini / Qwen3-8B, fits alongside Embed)  │
│  P2: User TTS (VV7B, swaps Embed out, generates, swaps back)        │
│  P3: Batch TTS (VV7B batch for nightly pipeline)                     │
│  P4: Maintenance (re-embedding, index rebuild)                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Cost Summary (Monthly)

| Service                         | Cost   | Notes                                              |
| ------------------------------- | ------ | -------------------------------------------------- |
| Embedding (Qwen3-Embed-8B)      | $0     | Local, Ollama                                      |
| Vector DB (Qdrant)              | $0     | Local, embedded                                    |
| TTS (VV7B/Kokoro/F5)            | $0     | Local, Docker                                      |
| Local LLM (Phi-4-mini/Qwen3-8B) | $0     | Local, Ollama                                      |
| Claude (complex tasks)          | $0     | Max subscription via `claude -p`                   |
| Deepgram (transcription)        | $0     | $200 free credit (~10 months)                      |
| Google APIs (Drive/Cal/Gmail)   | $0     | Free                                               |
| Slack API                       | $0     | Free                                               |
| **Total additional cost**       | **$0** | Everything leverages existing Max sub + free tiers |

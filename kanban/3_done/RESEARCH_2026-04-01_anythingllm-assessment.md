# AnythingLLM Research — Assessment for FractionalBuddy Integration

_Research date: 1 April 2026_

---

## 1. What is AnythingLLM?

AnythingLLM is an open-source (MIT), all-in-one AI application by Mintplex Labs (YC S22). It provides a private ChatGPT-like interface with RAG, AI Agents, meeting transcription, and more. **57.3k GitHub stars**, current version **v1.11.2**.

**Deployment options:**

| Option                      | Cost      | Users  | Meeting Assistant |
| --------------------------- | --------- | ------ | ----------------- |
| Desktop App (Win/Mac/Linux) | Free      | Single | YES               |
| Docker Self-Hosted          | Free      | Multi  | NO                |
| AnythingLLM Cloud           | $50-99/mo | Multi  | NO                |
| Railway/Render VPS          | ~$5-10/mo | Multi  | NO                |

**System requirements (Docker, cloud LLM providers):** 2-core CPU, 2GB RAM, 5GB storage. No GPU needed unless running local LLMs.

---

## 2. Meeting Assistant — The Headline Feature

The Meeting Assistant (v1.10.0+, January 2026) is the feature David is most interested in. Here's the full breakdown:

### Capabilities

- Records from **Zoom, Google Meet, Microsoft Teams**, and any other meeting platform
- Uploads pre-recorded meetings, podcasts, YouTube videos, audio/video files
- **Speaker identification** using LLM-based diarization (not voice-fingerprint — imperfect, disabled by default)
- Real-time rolling transcript (hardware-intensive, disabled by default, needs 16GB+ RAM)
- Automatic summarisation with configurable LLM (cloud or local)
- Summary templates: General Meeting, Sales Call, Engineering Meeting, Custom
- Agentic follow-up actions based on meeting content (runs only when user clicks "Run")
- Semantic search across all past meetings (local vector DB)
- Q&A workspace for asking questions about meeting history
- Click-to-jump audio playback with timeline navigation

### Speaker Management

- Identifies unique speakers by voice characteristics
- Click to rename speakers across entire transcript
- Correct mis-identifications manually
- Auto-cleanup of removed speakers
- **Limitation:** Speaker ID has "zero impact on the meeting summary or follow-up actions" — it's purely for transcript readability

### CRITICAL LIMITATION: Desktop Only

**The Meeting Assistant is NOT available in Docker or Cloud deployments.** It requires the desktop app. This means:

- Cannot run on P520 or X1EG3 as a headless server
- Cannot be used as a shared team service
- Each user needs the desktop app running during meetings
- No API access to meeting processing

### Transcription Engine

- **Local:** Built-in Xenova Whisper Small (ONNX, CPU-only, from HuggingFace)
- **Cloud:** OpenAI Whisper API
- No custom ASR model support (feature requested in GitHub issue #4899)

---

## 3. Docker Features (What You'd Actually Get on P520/X1EG3)

Without the Meeting Assistant, the Docker version provides:

### RAG & Document Management

- Upload PDFs, DOCX, TXT, MD, CSV, XLSX, PPTX, HTML, 50+ code file types
- Audio/video files transcribed via Whisper and ingested as text
- Pull from GitHub repos, YouTube transcripts, Confluence, websites
- Two modes: full-text attachment (uses more tokens) or RAG chunking (semantic retrieval)
- Configurable chunk size, similarity threshold, reranking
- Document pinning for critical docs (bypass RAG, full text always included)

### AI Agents

- Built-in tools: web search, web scraping, SQL queries, file operations
- **Agent Flows**: No-code visual workflow builder (Web Scraper → API Call → LLM Instruction → Read/Write File)
- Custom agent skills in JavaScript/NodeJS (hot-loaded, no restart)
- MCP support (Tools only — no Resources, Prompts, or Sampling)
- Intelligent tool selection (claims 80% token savings)

### Multi-User & Access Control

- Three roles: Admin, Manager, Default
- Workspace isolation (users only see assigned workspaces)
- Simple SSO passthrough for internal deployments
- Pre-provisioned users, temporary auth links

### Supported LLM Providers (30+)

Anthropic Claude, OpenAI, Azure OpenAI, AWS Bedrock, Google Gemini, Groq, Ollama, LM Studio, LocalAI, Mistral, Cohere, Together AI, OpenRouter, xAI, DeepSeek, and more.

### Supported Vector Databases

LanceDB (built-in), Pinecone, **Qdrant** (already on P520), Weaviate, Chroma, Milvus, PGVector, Zilliz, AstraDB.

### API

- RESTful API with Swagger docs at `/api/docs`
- Sync and streaming chat endpoints
- Full CRUD for workspaces, documents, users, system config
- Bearer token auth

### Embeddable Chat Widget

- `<script>` tag or `<iframe>` on any website
- White-label capable, customisable positioning and colours

---

## 4. Feature Comparison: AnythingLLM vs FractionalBuddy

| Feature                      | FractionalBuddy                                                     | AnythingLLM (Docker)               | AnythingLLM (Desktop)              |
| ---------------------------- | ------------------------------------------------------------------- | ---------------------------------- | ---------------------------------- |
| **Meeting Recording**        | Upload transcript (.txt)                                            | Upload audio/video (transcribed)   | Live recording + upload            |
| **Speaker ID**               | From SRT labels                                                     | N/A (Docker)                       | LLM-based diarization              |
| **Meeting Summarisation**    | Claude Sonnet 4 extraction                                          | Any LLM + templates                | Any LLM + templates                |
| **Task Extraction**          | Auto-creates tasks with confidence levels, source quotes, assignees | Follow-up actions (manual trigger) | Agentic follow-ups                 |
| **Time Tracking**            | Full: timer widget, categories, billable/non-billable, rounding     | None                               | None                               |
| **Invoicing**                | Invoice generation from timesheet, FreeAgent integration            | None                               | None                               |
| **CRM**                      | Customer profiles, Google Drive links, task/deliverable counts      | None                               | None                               |
| **Engagement Management**    | Contract terms, scope, scope creep tracking                         | None                               | None                               |
| **Client Portal**            | Role-based (consultant/client), visibility controls                 | Multi-user workspaces              | Single user                        |
| **Deliverables**             | Version tracking, status progression, due dates                     | None                               | None                               |
| **RAG / Knowledge Base**     | None (planned?)                                                     | Full RAG with vector DB            | Full RAG with vector DB            |
| **Document Q&A**             | None                                                                | Ask questions about uploaded docs  | Ask questions + meeting history    |
| **Agent Skills**             | None                                                                | Custom JS agents, MCP, flows       | Custom agents + OS-level tools     |
| **Multi-LLM Support**        | Claude + Gemini (hardcoded)                                         | 30+ providers, per-workspace       | 30+ providers                      |
| **Onboarding Questionnaire** | 40+ pre-built questions, client self-service                        | None                               | None                               |
| **Notes & Research**         | Structured notes with types, tags, visibility                       | Chat history per workspace         | Chat history                       |
| **Contract Analysis**        | PDF upload → Gemini extraction                                      | Upload PDF as RAG document         | Upload PDF as RAG document         |
| **Scope Creep Tracking**     | Dedicated logging with status                                       | None                               | None                               |
| **Semantic Search**          | None (Fuse.js client-side)                                          | Vector-based semantic search       | Vector-based + meeting search      |
| **Calendar**                 | Placeholder (coming soon)                                           | None                               | Desktop notifications for meetings |
| **Embeddable Widget**        | None                                                                | Chat widget for websites           | None                               |

---

## 5. Assessment: Combine, Replace, or Borrow Ideas?

### Option A: Replace FractionalBuddy with AnythingLLM — NOT RECOMMENDED

AnythingLLM is a **knowledge management / AI chat platform**, not a business operations tool. It has zero support for:

- Time tracking and billing
- CRM and customer management
- Engagement/contract management
- Scope tracking
- Invoicing
- Deliverable management
- Client portal with role-based access

These are FractionalBuddy's core value proposition. AnythingLLM would replace perhaps 10% of the functionality (meeting processing) while losing 90% (everything else).

### Option B: Run AnythingLLM Alongside FractionalBuddy — PARTIALLY RECOMMENDED

**Use AnythingLLM Docker on P520 as a knowledge base companion:**

| Use Case                                                                                | Value                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Upload all LoveSac docs (solution design, architecture, requirements) and ask questions | HIGH — saves time searching across 8+ documents                                |
| Upload meeting transcripts and search across all past meetings semantically             | MEDIUM — FractionalBuddy already stores transcripts, but lacks semantic search |
| Create per-customer workspaces (LoveSac, future clients) with relevant docs             | MEDIUM — nice organisation but not critical                                    |
| Use Agent Flows for automated research/analysis workflows                               | LOW — Claude Code already does this better                                     |
| Embeddable chat widget on FractionalBuddy                                               | LOW — adds complexity without clear value                                      |

**Concerns with running alongside:**

- Another service to maintain on P520 (port 3001, Docker container)
- Data duplication (transcripts and docs in both systems)
- Context switching between two UIs for related workflows
- LLM costs doubled (queries go to Claude/OpenAI from both systems)

### Option C: Borrow Ideas and Build into FractionalBuddy — RECOMMENDED

The most valuable AnythingLLM features that FractionalBuddy lacks:

#### 1. RAG-based Document Q&A (HIGH VALUE)

**What:** Upload project documents and ask questions across them using semantic search.
**Why:** David already has 8+ LoveSac documents and will accumulate more per client. Currently, finding specific answers requires manually reading docs or asking Claude with pasted content.
**How to implement:**

- Use Qdrant (already on P520) as vector store
- Use Supabase `pgvector` extension (simpler, already have PostgreSQL)
- Chunk documents on upload, embed with OpenAI/Voyage embeddings
- Add "Ask about [Customer]" chat interface scoped to customer's documents
- **Estimated effort:** 2-3 prompts (embedding pipeline + chat UI + retrieval)

#### 2. Meeting Semantic Search (MEDIUM VALUE)

**What:** Search across all past meeting transcripts using semantic similarity, not just keyword matching.
**Why:** As meetings accumulate, finding "what did Sana say about Celigo?" across 50+ meetings needs more than Fuse.js.
**How to implement:**

- Embed meeting transcripts (already stored in DB) into vector store
- Add semantic search to meetings page
- **Estimated effort:** 1 prompt (re-uses RAG infrastructure from #1)

#### 3. Meeting Summary Templates (MEDIUM VALUE)

**What:** Configurable templates for different meeting types (kickoff, sprint review, architecture review, sales call).
**Why:** The current Claude prompt is generic. A kickoff meeting needs different extraction than a sprint review.
**How to implement:**

- Add `meeting_type` field to meetings table
- Create template prompts per type (store in DB or config)
- Select template during transcript upload
- **Estimated effort:** 1 prompt

#### 4. Live Meeting Recording + Transcription (HIGH VALUE — but complex)

**What:** Record meetings directly from the browser, transcribe in real-time or post-meeting.
**Why:** Currently David must use a separate tool (Otter.ai, Teams recording, etc.) then upload the transcript manually. An integrated recorder eliminates the friction.
**How to implement:**

- Browser MediaRecorder API captures audio from tab/microphone
- Send audio to OpenAI Whisper API or local Whisper for transcription
- Feed transcript into existing Claude processing pipeline
- **Estimated effort:** 3-4 prompts (audio capture + transcription service + UI + speaker diarization)
- **Alternative:** Use AnythingLLM Desktop purely as the recording tool, then export transcripts into FractionalBuddy via API

#### 5. Agent Flows / Automated Workflows (LOW VALUE for now)

**What:** Visual workflow builder for automated analysis chains.
**Why:** Could automate "when a new meeting is processed, check if any tasks are duplicates of existing ones" or "when a new document is uploaded, compare against existing architecture decisions."
**How:** Premature — FractionalBuddy doesn't have enough automation needs yet. Revisit when there are 5+ clients.

---

## 6. Recommended Architecture: Hybrid Approach

```
┌──────────────────────────────────────────────────┐
│                  David's Workflow                  │
├──────────────────────────────────────────────────┤
│                                                    │
│  ┌─────────────────┐    ┌──────────────────────┐  │
│  │  AnythingLLM    │    │   FractionalBuddy    │  │
│  │  Desktop App    │    │   (Next.js on P520)  │  │
│  │                 │    │                      │  │
│  │  • Live meeting │───>│  • Upload transcript │  │
│  │    recording    │    │  • Claude extraction │  │
│  │  • Speaker ID   │    │  • Task creation     │  │
│  │  • Quick export │    │  • Time logging      │  │
│  │                 │    │  • CRM + Billing     │  │
│  └─────────────────┘    │  • Deliverables      │  │
│                         │  • Client portal     │  │
│                         │                      │  │
│                         │  NEW: RAG Q&A ────────┼──┐
│                         │  NEW: Semantic search │  │
│                         │  NEW: Meeting templates│  │
│                         └──────────────────────┘  │
│                                                    │
│                         ┌──────────────────────┐  │
│                         │  Qdrant / pgvector   │<─┘
│                         │  (Vector Store)      │
│                         │  Already on P520     │
│                         └──────────────────────┘  │
│                                                    │
└──────────────────────────────────────────────────┘
```

**Phase 1 — Quick Win (This Week)**

1. Install AnythingLLM Desktop on X1EG3 for meeting recording
2. Configure with Anthropic Claude API key
3. Use for live meeting recording → export transcript → upload to FractionalBuddy
4. No server-side AnythingLLM needed

**Phase 2 — FractionalBuddy RAG (2-3 Prompts)**

1. Add document embedding pipeline using pgvector (Supabase) or Qdrant
2. Build "Ask about [Customer]" chat interface
3. Auto-embed meeting transcripts and uploaded assets

**Phase 3 — Enhanced Meetings (1-2 Prompts)**

1. Meeting type templates for Claude extraction
2. Semantic search across meetings
3. Optional: browser-based audio recording (eliminates AnythingLLM Desktop dependency)

---

## 7. AnythingLLM Docker Quick-Start (If You Want to Try It)

```bash
# On P520 or X1EG3
export STORAGE_LOCATION=$HOME/anythingllm
mkdir -p $STORAGE_LOCATION
touch "$STORAGE_LOCATION/.env"

docker pull mintplexlabs/anythingllm:latest
docker run -d \
  -p 3001:3001 \
  --name anythingllm \
  --cap-add SYS_ADMIN \
  -v ${STORAGE_LOCATION}:/app/server/storage \
  -e STORAGE_DIR="/app/server/storage" \
  mintplexlabs/anythingllm:latest
```

- Access at `http://localhost:3001` (or `http://192.168.178.50:3001` from network)
- First-run wizard: select Claude as LLM, LanceDB as vector DB
- Upload LoveSac docs into a "LoveSac" workspace to test RAG quality
- Port 3001 conflicts with P520 Coolify GWTH test — change to 3003 or similar

**Environment variables of interest:**

```env
DISABLE_TELEMETRY=true
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
EMBEDDING_ENGINE=native     # Built-in, no API cost
VECTOR_DB=lancedb           # Built-in, or use "qdrant" to connect to existing
```

---

## 8. AnythingLLM Cloud ($50-99/mo) — Not Recommended

The cloud version has significant limitations compared to self-hosted:

- No custom agent skills
- No MCP support
- No built-in LLM (no GPU)
- Built-in embedder crashes on large documents (5,000+ pages)
- No Meeting Assistant (Desktop only)
- More expensive than self-hosting for equivalent capability

Self-hosted Docker or Desktop gives everything Cloud offers plus more, for free.

---

## 9. Key Risks & Considerations

| Risk                              | Impact                           | Mitigation                                                                                                   |
| --------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Meeting Assistant is Desktop-only | Cannot run as shared service     | Use Desktop on X1EG3; long-term, build browser recording into FractionalBuddy                                |
| Speaker ID is imperfect           | Wrong speaker attribution        | Manual correction in AnythingLLM before export; FractionalBuddy SRT parser already handles labelled speakers |
| Data duplication                  | Docs/transcripts in two systems  | Use AnythingLLM only for recording; all storage and processing in FractionalBuddy                            |
| Maintenance overhead              | Another Docker container on P520 | Skip Docker entirely; Desktop-only for recording                                                             |
| LLM cost duplication              | Both systems calling Claude API  | Configure AnythingLLM to use a cheaper model (Gemini Flash) for summaries; Claude only in FractionalBuddy    |
| Port conflict on P520             | 3001 used by Coolify test app    | Use port 3003 if deploying Docker                                                                            |

---

## 10. Summary & Recommendations

| Recommendation                                                                                                  | Priority | Action                                                  |
| --------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------- |
| **Install AnythingLLM Desktop on X1EG3** for meeting recording + speaker ID                                     | HIGH     | Download from anythingllm.com, configure Claude API key |
| **Do NOT deploy AnythingLLM Docker on P520** — the Meeting Assistant (the main value) isn't available in Docker | —        | Skip                                                    |
| **Do NOT use AnythingLLM Cloud** — expensive, limited, no Meeting Assistant                                     | —        | Skip                                                    |
| **Build RAG Q&A into FractionalBuddy** using pgvector/Qdrant                                                    | HIGH     | Plan as 2-3 kanban prompts                              |
| **Add meeting type templates** to FractionalBuddy                                                               | MEDIUM   | Plan as 1 kanban prompt                                 |
| **Add semantic search** for meetings                                                                            | MEDIUM   | Plan as 1 kanban prompt (after RAG)                     |
| **Consider browser audio recording** in FractionalBuddy long-term                                               | LOW      | Revisit after RAG + templates shipped                   |

**Bottom line:** AnythingLLM Desktop is useful as a **meeting recording tool** to feed transcripts into FractionalBuddy. The Docker/Cloud versions add little value since the Meeting Assistant is Desktop-only, and the RAG/agent features are better built natively into FractionalBuddy where they integrate with CRM, timesheet, and task management. The most impactful next step for FractionalBuddy is adding RAG-based document Q&A — this is the one AnythingLLM capability that would genuinely accelerate David's workflow.

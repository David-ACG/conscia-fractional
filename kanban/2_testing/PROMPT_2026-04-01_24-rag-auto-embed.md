# PROMPT 24: Auto-Embed Meetings + Drive Files + Assets

> **Phase 6 — RAG Document Q&A (Prompt 24 of 24)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

**IMPORTANT:** This project uses **Qdrant** for vector storage (NOT pgvector). Qdrant runs at `QDRANT_URL` (default: `http://192.168.178.50:6333`). Embeddings via **Qwen3-Embedding-8B** at `OLLAMA_BASE_URL` (default: `http://192.168.178.50:11434`). Vector dimensions: **4096**, distance metric: **cosine**. Collection name: `fractionalbuddy_docs`.

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Qdrant client** (from Prompt 22) at `src/lib/qdrant-client.ts` with `getQdrantClient()`, `ensureCollection()`, `COLLECTION_NAME`
- **Embedding service** (from Prompt 22) at `src/lib/services/embedding-service.ts` with `embed()`, `embedBatch()`
- **Chunking service** (from Prompt 22) at `src/lib/services/chunking-service.ts` with `chunkText()`, `chunkDocument()`
- **Document service** (from Prompt 22) at `src/lib/services/document-service.ts` with `getDocuments()`, `deleteDocument()`
- **RAG service** (from Prompt 23) at `src/lib/services/rag-service.ts` with `search()`, `generateAnswer()`
- **Document chat** (from Prompt 23) at `src/components/crm/document-chat.tsx` on CRM detail page "Ask" tab
- **Documents table** in Supabase: `id`, `user_id`, `crm_customer_id`, `name`, `source_type`, `source_id`, `chunk_count`, `embedded_at` (null = pending), `metadata`, `created_at`
- **Qdrant points** stored with payload: `{ document_id, chunk_index, content, source_type, crm_customer_id, user_id, name }`
- **Existing `meetings` table** with transcript content (text field or related transcript records)
- **Existing `assets` table** for uploaded files (with Supabase Storage)
- **Google Drive service** (from Prompt 08) for accessing Drive files
- **Existing cron pattern**: cron routes secured with `CRON_SECRET` env var, checked via `Authorization: Bearer <CRON_SECRET>` header
- **Upload API** (from Prompt 22) at `src/app/api/documents/upload/route.ts` handles text content

## Task

### 1. Install Text Extraction Packages

Run: `npm install pdf-parse mammoth`
Run: `npm install -D @types/pdf-parse` (if types available, otherwise create minimal type declaration)

### 2. Create Text Extraction Service

**File:** `src/lib/services/text-extraction-service.ts`

```typescript
// extractText(buffer: Buffer, mimeType: string) → Promise<string>
//
// Based on mimeType:
// - 'application/pdf':
//     import pdf from 'pdf-parse'
//     const data = await pdf(buffer)
//     return data.text
//
// - 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' (DOCX):
//     import mammoth from 'mammoth'
//     const result = await mammoth.extractRawText({ buffer })
//     return result.value
//
// - 'text/plain', 'text/markdown', 'text/csv':
//     return buffer.toString('utf-8')
//
// - 'application/json':
//     return buffer.toString('utf-8')
//
// - Unsupported types:
//     throw new Error(`Unsupported file type: ${mimeType}`)

// getSupportedMimeTypes() → string[]
//   - Returns array of all supported MIME types
//   - Useful for validation in upload flows
```

### 3. Create Auto-Embedding Service

**File:** `src/lib/services/auto-embed-service.ts`

```typescript
// embedMeeting(meetingId: string, userId: string) → Promise<void>
//
// 1. Fetch meeting record from meetings table via admin client
// 2. Get transcript content (check how transcripts are stored — likely a text field or related table)
// 3. If no transcript content, skip (log warning)
// 4. Check for existing document with source_type='meeting' AND source_id=meetingId
//    - If exists and embedded_at is not null: skip (already embedded, prevent duplicates)
//    - If exists and embedded_at is null: will be processed by cron (already queued)
// 5. Create document record via admin client:
//    { user_id: userId, crm_customer_id: meeting.crm_customer_id, name: `Meeting: ${meeting.title || meeting.date}`,
//      source_type: 'meeting', source_id: meetingId, metadata: { meeting_date: meeting.date } }
// 6. Return (actual embedding happens in cron — this just queues it)

// embedDriveFile(driveFileId: string, userId: string, integrationId: string) → Promise<void>
//
// 1. Get integration record, decrypt access token
// 2. Download file content from Google Drive via googleapis:
//    - For Google Docs: export as text/plain
//    - For Google Sheets: export as text/csv
//    - For Google Slides: export as text/plain
//    - For other files: download raw content
// 3. Extract text using text-extraction-service (based on file mimeType)
// 4. Check for existing document with source_type='drive_file' AND source_id=driveFileId
//    - If exists and embedded_at is not null: skip (already embedded)
// 5. Create document record:
//    { user_id: userId, crm_customer_id: (look up from drive file metadata or mapping),
//      name: driveFile.name, source_type: 'drive_file', source_id: driveFileId,
//      metadata: { drive_file_id: driveFileId, mime_type: driveFile.mimeType } }
// 6. Store the extracted text in metadata.content (for the cron to embed later)
//    OR embed immediately if the text is small enough (<50KB)

// embedAsset(assetId: string, userId: string) → Promise<void>
//
// 1. Fetch asset record from assets table via admin client
// 2. Download file from Supabase Storage
// 3. Extract text using text-extraction-service
// 4. Duplicate check (same pattern as above)
// 5. Create document record with source_type='asset'
// 6. Store extracted text in metadata.content for cron processing

// embedNote(noteId: string, userId: string) → Promise<void>
//
// 1. Fetch note record (check what table notes are stored in)
// 2. Notes are already text — no extraction needed
// 3. Duplicate check
// 4. Create document record with source_type='note'
// 5. Store text in metadata.content for cron processing

// processDocument(documentId: string) → Promise<void>
//
// This is the core function called by the cron job:
// 1. Fetch document record via admin client
// 2. Get content:
//    - If metadata.content exists: use it directly
//    - If source_type='meeting': re-fetch transcript from meetings table
//    - If source_type='upload': content was already embedded at upload time, skip
// 3. Chunk content using chunking-service
// 4. Embed chunks using embedding-service.embedBatch
// 5. Ensure Qdrant collection exists
// 6. Upsert points to Qdrant with correct payloads
// 7. Update document: chunk_count = N, embedded_at = now()
// 8. Clean up: remove metadata.content (no longer needed after embedding)
```

### 4. Integrate Auto-Embedding into Existing Flows

**Non-blocking pattern:** These should not block the main flow. Use a simple approach: create the document record (which serves as the queue entry), and let the cron job handle the actual embedding.

**Modify:** Meeting transcript processing endpoint (find the relevant API route — likely `src/app/api/meetings/` or similar)

- After transcript is processed/saved: call `embedMeeting(meetingId, userId)`
- Wrap in try/catch — embedding failure should not break meeting processing

**Modify:** Asset upload flow (find the relevant handler)

- After asset is uploaded: call `embedAsset(assetId, userId)`
- Wrap in try/catch

**Note:** Drive file embedding is triggered by the cron in Prompt 24, not on individual file access. Google Drive sync (if it exists from Prompt 08) should trigger `embedDriveFile` for new/modified files.

### 5. Create Embedding Cron Route

**File:** `src/app/api/cron/embed-documents/route.ts`

```typescript
// GET (or POST)
// 1. Verify CRON_SECRET: check Authorization header matches Bearer <process.env.CRON_SECRET>
// 2. Fetch documents where embedded_at IS NULL, ordered by created_at ASC
//    - Limit: 10 per cron run (respect Ollama rate limits and prevent timeout)
//    - Use admin client
// 3. For each document:
//    a. Call auto-embed-service.processDocument(documentId)
//    b. If error: log error, update document metadata with { embed_error: error.message, embed_attempts: N+1 }
//    c. If embed_attempts > 3: skip document in future runs (mark as failed in metadata)
// 4. Return summary: { processed: N, succeeded: N, failed: N, skipped: N, remaining: N }
// 5. Log timing: total time and per-document average
```

### 6. Create Document Management UI

**Modify:** `src/components/crm/document-chat.tsx` (or create a new sibling component)

Add a "Documents" section above or alongside the chat in the "Ask" tab:

**File:** `src/components/crm/document-list.tsx`

- Collapsible section showing all embedded documents for this customer
- Fetches from `src/app/api/documents/list/route.ts` (new route, see below)
- Each document row shows:
  - Icon based on source_type (Lucide: `FileText` for meetings, `HardDrive` for drive files, `Paperclip` for assets, `StickyNote` for notes, `Upload` for uploads)
  - Document name
  - Source type badge
  - Chunk count
  - Status indicator:
    - Embedded: green check icon with embedded date
    - Pending: yellow clock icon with "Processing..."
    - Failed: red X icon with error message (from metadata.embed_error)
  - "Re-embed" button: deletes existing Qdrant points and sets embedded_at to null (triggers re-processing by cron)
- "Upload Document" button: opens a file upload dialog
  - Accept: .txt, .md, .pdf, .docx, .json, .csv
  - On upload: POST to `/api/documents/upload` (from Prompt 22)
  - Show progress/success feedback
- Summary line at top: "X documents, Y chunks indexed"

**File:** `src/app/api/documents/list/route.ts`

```typescript
// GET ?crm_customer_id=...
// 1. Verify authenticated user
// 2. Call document-service.getDocuments(userId, crmCustomerId)
// 3. Return: { documents: Document[], total: number, embedded_count: number, total_chunks: number }
```

**File:** `src/app/api/documents/[id]/reembed/route.ts`

```typescript
// POST
// 1. Verify authenticated user owns the document
// 2. Delete existing Qdrant points for this document (filter by payload.document_id)
// 3. Update document: embedded_at = null, chunk_count = 0
//    (This effectively re-queues the document for the embedding cron)
// 4. Return: { success: true }
```

### 7. Update Upload Route for Binary Files

**Modify:** `src/app/api/documents/upload/route.ts` (from Prompt 22)

- Now handle binary files (PDF, DOCX) using text-extraction-service
- Accept file upload (multipart form data)
- Extract text from file based on MIME type
- Validate against supported MIME types
- Rest of the flow remains the same (chunk, embed, store)

### 8. Write Vitest Tests

**File:** `src/lib/services/__tests__/text-extraction-service.test.ts`

Test:

- Extracts text from plain text buffer
- Extracts text from PDF buffer (mock pdf-parse)
- Extracts text from DOCX buffer (mock mammoth)
- Throws error for unsupported MIME types
- `getSupportedMimeTypes` returns correct list

**File:** `src/lib/services/__tests__/auto-embed-service.test.ts`

Test:

- `embedMeeting` creates document record with correct source_type and source_id
- `embedMeeting` skips if already embedded (duplicate prevention)
- `embedMeeting` skips if no transcript content
- `embedDriveFile` downloads and extracts text from Drive file
- `embedAsset` downloads from Supabase Storage and extracts text
- `embedNote` creates document record for note content
- `processDocument` chunks, embeds, and stores in Qdrant
- `processDocument` updates chunk_count and embedded_at
- `processDocument` cleans up metadata.content after embedding
- Mock: Supabase admin client, Qdrant client, embedding service, text extraction

**File:** `src/app/api/cron/__tests__/embed-documents.test.ts`

Test:

- Returns 401 when CRON_SECRET missing or wrong
- Processes pending documents (embedded_at IS NULL)
- Limits to 10 per run
- Skips documents with embed_attempts > 3
- Increments embed_attempts on failure
- Returns correct summary counts

**File:** `src/components/crm/__tests__/document-list.test.tsx`

Test:

- Renders document list with correct icons per source type
- Shows status indicators (embedded, pending, failed)
- "Re-embed" button calls re-embed API
- "Upload Document" button opens file dialog
- Summary line shows correct counts

## File Paths Summary

| Action  | Path                                                              |
| ------- | ----------------------------------------------------------------- |
| Create  | `src/lib/services/text-extraction-service.ts`                     |
| Create  | `src/lib/services/auto-embed-service.ts`                          |
| Create  | `src/app/api/cron/embed-documents/route.ts`                       |
| Create  | `src/components/crm/document-list.tsx`                            |
| Create  | `src/app/api/documents/list/route.ts`                             |
| Create  | `src/app/api/documents/[id]/reembed/route.ts`                     |
| Create  | `src/lib/services/__tests__/text-extraction-service.test.ts`      |
| Create  | `src/lib/services/__tests__/auto-embed-service.test.ts`           |
| Create  | `src/app/api/cron/__tests__/embed-documents.test.ts`              |
| Create  | `src/components/crm/__tests__/document-list.test.tsx`             |
| Modify  | `src/app/api/documents/upload/route.ts` (add binary file support) |
| Modify  | Meeting transcript processing endpoint (add embedMeeting call)    |
| Modify  | Asset upload flow (add embedAsset call)                           |
| Modify  | `src/components/crm/document-chat.tsx` (integrate document-list)  |
| Install | `pdf-parse`, `mammoth`, `@types/pdf-parse`                        |

## Acceptance Criteria

- [ ] Meetings auto-queued for embedding after transcript processing
- [ ] Drive files downloaded, text extracted, and queued for embedding
- [ ] Assets queued for embedding on upload
- [ ] Notes queued for embedding
- [ ] PDF text extraction works (via pdf-parse)
- [ ] DOCX text extraction works (via mammoth)
- [ ] Duplicate embedding prevented (check source_type + source_id before creating document)
- [ ] Background queue: document record with null embedded_at serves as queue entry
- [ ] Cron processes up to 10 pending documents per run
- [ ] Cron retries failed documents up to 3 times, then skips
- [ ] Document list shows on CRM detail page "Ask" tab with status indicators
- [ ] "Re-embed" button works (deletes Qdrant points, resets embedded_at)
- [ ] "Upload Document" handles PDF and DOCX files
- [ ] Summary shows document/chunk counts
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Qdrant used (NOT pgvector) for all vector operations
- [ ] Auto-embedding is non-blocking (document record = queue entry, cron does actual work)
- [ ] Duplicate prevention checks source_type + source_id
- [ ] Cron has retry limit (3 attempts) to prevent infinite loops

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_24-rag-auto-embed.md`

---

## Implementation Notes — 2026-04-02 13:45

- **Commit:** 84286a5 feat(prompt-24): auto-embed meetings, drive files, assets + document management UI
- **Tests:** 761 passed (77 test files)
- **Verification URL:** http://localhost:3002/dashboard/crm/{customer-slug} → Ask tab
- **Playwright check:** Not run (no live server at time of implementation)
- **Changes summary:**
  - `src/lib/services/text-extraction-service.ts` — PDF (pdf-parse), DOCX (mammoth), text/CSV/JSON extraction
  - `src/lib/services/auto-embed-service.ts` — embedMeeting/embedDriveFile/embedAsset/embedNote + processDocument cron core
  - `src/app/api/cron/embed-documents/route.ts` — GET cron, batch=10, 3-attempt retry, returns summary
  - `src/components/crm/document-list.tsx` — collapsible list, source icons, status indicators, re-embed, file upload
  - `src/app/api/documents/list/route.ts` — GET with embedded_count, total_chunks in response
  - `src/app/api/documents/[id]/reembed/route.ts` — POST clears Qdrant points, resets embedded_at to null
  - `src/app/api/documents/upload/route.ts` — modified to use text-extraction-service for PDF/DOCX
  - `src/lib/actions/meetings.ts` — createMeetingFromTranscript now calls embedMeeting (non-blocking)
  - `src/lib/actions/assets.ts` — createAsset now calls embedAsset when file_url present (non-blocking)
  - `src/components/crm/document-chat.tsx` — DocumentList integrated above chat, uses /api/documents/list
- **Deviations from plan:**
  - Notes table has no crm_customer_id — embedNote sets crm_customer_id=null
  - Drive file embedding integrated into auto-embed-service but not wired to drive-sync-service (drive sync only updates drive_files table, not embedding; would need separate wiring)
- **Follow-up issues:**
  - Wire embedDriveFile into drive-sync-service (call for new/modified files in syncFolder)
  - Add embedNote trigger when notes are created/updated
  - Playwright verification of the Ask tab DocumentList UI

---

## Testing Checklist — 2026-04-02 13:45

**Check the changes:** http://localhost:3002 (navigate to a CRM customer → Ask tab)

- [ ] Page loads without errors
- [ ] DocumentList renders above chat with "Documents" header and "Upload Document" button
- [ ] Upload a .txt file — document appears in list as "upload" type with "Processing…" status
- [ ] After cron runs (`curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/embed-documents`), document shows embedded date with green check
- [ ] "Re-embed" button clears status back to "Processing…"
- [ ] Upload a .pdf or .docx — should extract text and embed correctly
- [ ] Create a meeting via transcript processing — document queued automatically
- [ ] Create an asset with file_url — document queued automatically
- [ ] Cron returns 401 without correct Authorization header
- [ ] No console errors

### Actions for David

1. Navigate to a CRM customer page → "Ask" tab
2. Upload a plain text file using "Upload Document" button, verify it appears in DocumentList
3. Run the embedding cron manually: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3002/api/cron/embed-documents`
4. Verify the document status changes from "Processing…" to a green embedded date
5. Test asking a question in the chat about the uploaded document

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_24-rag-auto-embed.md`

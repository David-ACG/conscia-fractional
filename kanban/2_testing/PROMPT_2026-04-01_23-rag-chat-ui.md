# PROMPT 23: "Ask About [Customer]" Chat UI with Retrieval

> **Phase 6 — RAG Document Q&A (Prompt 23 of 24)**
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
- **Chunking service** (from Prompt 22) at `src/lib/services/chunking-service.ts`
- **Document service** (from Prompt 22) at `src/lib/services/document-service.ts` with `getDocuments()`, `deleteDocument()`
- **Documents table** in Supabase: `id`, `user_id`, `crm_customer_id`, `name`, `source_type`, `source_id`, `chunk_count`, `embedded_at`, `metadata`, `created_at`
- **Qdrant points** stored with payload: `{ document_id, chunk_index, content, source_type, crm_customer_id, user_id, name }`
- **CRM customer detail pages** at `/dashboard/crm/[slug]` with a tabbed layout
- **`@anthropic-ai/sdk`** is installed (Anthropic SDK for Claude API)
- **Env var:** `ANTHROPIC_API_KEY` should already be in `.env.local.example` (if not, add it)

## Task

### 1. Create RAG Service

**File:** `src/lib/services/rag-service.ts`

```typescript
// Types:
// SearchResult {
//   content: string       // the chunk text
//   score: number         // similarity score from Qdrant
//   documentName: string  // from payload.name
//   sourceType: string    // from payload.source_type
//   chunkIndex: number    // from payload.chunk_index
//   documentId: string    // from payload.document_id
// }

// search(query: string, options: {
//   userId: string,          // REQUIRED: security filter
//   crmCustomerId?: string,  // optional: scope to customer
//   limit?: number           // default: 5
// }) → Promise<SearchResult[]>
//
// 1. Embed the query using embedding-service.embed(query)
// 2. Search Qdrant collection COLLECTION_NAME:
//    - Vector: the query embedding
//    - Limit: options.limit (default 5)
//    - Filter (MUST filter):
//      - payload.user_id must match options.userId (security: never return other users' data)
//      - If crmCustomerId provided: payload.crm_customer_id must match
//    - With payload: true (return all payload fields)
// 3. Map results to SearchResult array
// 4. Return sorted by score descending

// generateAnswer(query: string, context: SearchResult[], options?: {
//   crmCustomerName?: string
// }) → Promise<{ answer: string, sources: { name: string, sourceType: string }[] }>
//
// 1. Format context into a prompt string:
//    For each result:
//      "--- Source: {documentName} ({sourceType}) ---\n{content}\n\n"
// 2. Call Claude via Anthropic SDK:
//    import Anthropic from '@anthropic-ai/sdk'
//    const client = new Anthropic()  // uses ANTHROPIC_API_KEY env var
//    const response = await client.messages.create({
//      model: 'claude-sonnet-4-20250514',
//      max_tokens: 1024,
//      system: `You are a helpful assistant for a fractional executive. Answer questions based on the provided context documents about ${crmCustomerName || 'this customer'}. Cite your sources by document name. If the context doesn't contain enough information to answer, say so clearly.`,
//      messages: [{ role: 'user', content: `Context:\n${formattedContext}\n\nQuestion: ${query}` }]
//    })
// 3. Extract unique sources from the context results
// 4. Return { answer: response.content[0].text, sources }
```

### 2. Create Search API Route

**File:** `src/app/api/documents/search/route.ts`

```typescript
// POST body: { query: string, crm_customer_id?: string, generate_answer?: boolean }
// 1. Verify authenticated user
// 2. Validate: query is non-empty string
// 3. Call rag-service.search(query, { userId, crmCustomerId })
// 4. If generate_answer is true:
//    a. Optionally look up CRM customer name for better context
//    b. Call rag-service.generateAnswer(query, searchResults, { crmCustomerName })
//    c. Return: { answer: string, sources: [...], results: SearchResult[] }
// 5. If generate_answer is false:
//    a. Return: { results: SearchResult[] }
// 6. Handle errors: no documents found (return empty results, not error), Qdrant connection failure, Ollama failure
```

### 3. Create Document Chat Component

**File:** `src/components/crm/document-chat.tsx`

- Chat-style interface for the CRM customer detail page
- State: array of `{ role: 'user' | 'assistant', content: string, sources?: Source[], timestamp: Date }`
- Input:
  - Text input at the bottom with send button (Lucide `Send` icon)
  - Submit on Enter, Shift+Enter for newline
  - Disabled while waiting for response
- Message display:
  - User messages: right-aligned, blue background
  - Assistant messages: left-aligned, grey background
    - Answer text (supports basic markdown rendering — bold, italic, lists)
    - Sources section below answer: chips/tags showing document name + source type
    - "Show context" toggle button: expands to show the actual retrieved chunks with relevance scores
  - Auto-scroll to newest message
- Loading state: typing indicator (three dots animation) while waiting for response
- Empty state when no messages yet:
  - If documents exist for this customer: "Ask a question about [Customer Name]" with example questions
  - If no documents: "No documents found for this customer. Upload documents or wait for automatic embedding to start asking questions." with link to upload
- Chat history persists in component state during the session (cleared on tab change/navigation)

### 4. Add "Ask" Tab to CRM Customer Detail Page

- Find the existing tabbed layout in the CRM detail page component
- Add an "Ask" tab with a `MessageCircleQuestion` icon (Lucide)
- Tab renders `<DocumentChat customerId={customer.id} customerName={customer.name} />`

### 5. Add ANTHROPIC_API_KEY to .env.local.example (if not present)

Check `.env.local.example` — if `ANTHROPIC_API_KEY` is not already there, add:

```
# Anthropic Claude API (for RAG answer generation)
ANTHROPIC_API_KEY=
```

### 6. Write Vitest Tests

**File:** `src/lib/services/__tests__/rag-service.test.ts`

Test:

- `search` embeds query and searches Qdrant with correct filters
- `search` filters by user_id (security test: never returns other users' data)
- `search` filters by crm_customer_id when provided
- `search` returns results sorted by score
- `search` returns empty array when no matches (not an error)
- `generateAnswer` formats context correctly in the prompt
- `generateAnswer` calls Anthropic SDK with correct parameters
- `generateAnswer` extracts unique sources from results
- Mock: QdrantClient.search, embedding-service.embed, Anthropic.messages.create

**File:** `src/components/crm/__tests__/document-chat.test.tsx`

Test:

- Renders input field and send button
- Submitting a question adds user message to chat
- Assistant response rendered after API call
- Sources shown below answer
- "Show context" toggle reveals retrieved chunks
- Loading indicator shown while waiting
- Empty state renders correctly (with and without documents)
- Input disabled while processing

## File Paths Summary

| Action | Path                                                    |
| ------ | ------------------------------------------------------- |
| Create | `src/lib/services/rag-service.ts`                       |
| Create | `src/app/api/documents/search/route.ts`                 |
| Create | `src/components/crm/document-chat.tsx`                  |
| Create | `src/lib/services/__tests__/rag-service.test.ts`        |
| Create | `src/components/crm/__tests__/document-chat.test.tsx`   |
| Modify | CRM customer detail page component (add "Ask" tab)      |
| Modify | `.env.local.example` (add ANTHROPIC_API_KEY if missing) |

## Acceptance Criteria

- [ ] RAG search embeds query and returns relevant chunks from Qdrant
- [ ] Security: search always filters by user_id (never leaks other users' documents)
- [ ] Answer generation uses Claude via Anthropic SDK with retrieved context
- [ ] Source citations included in generated answers
- [ ] Chat UI renders on CRM customer detail page as "Ask" tab
- [ ] Chat messages display correctly (user right, assistant left)
- [ ] Sources shown as clickable chips below answers
- [ ] "Show context" toggle reveals retrieved chunks
- [ ] Chat history persists during the session
- [ ] Empty state handles both "no documents" and "ask a question" cases
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Qdrant search uses payload filters (not metadata) for user_id and crm_customer_id
- [ ] Anthropic SDK usage is correct (not OpenAI-style)
- [ ] Security: user_id filter is mandatory, never optional

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_23-rag-chat-ui.md`

---

## Implementation Notes — 2026-04-02 13:15

- **Commit:** b415b92 feat(prompt-23): rag chat ui with retrieval - ask tab on crm customer pages
- **Tests:** 725 passed (73 test files) — all green
- **Verification URL:** http://localhost:3002/dashboard/crm/[slug] — click "Ask" tab
- **Playwright check:** not applicable (no local dev server in build context)
- **Changes summary:**
  - `src/lib/services/rag-service.ts` — `search()` embeds query, searches Qdrant with mandatory `user_id` filter + optional `crm_customer_id` filter; `generateAnswer()` calls Claude `claude-sonnet-4-20250514` via Anthropic SDK with formatted context and source deduplication
  - `src/app/api/documents/search/route.ts` — POST endpoint: auth check, validates query, calls rag-service, optionally looks up customer name and generates answer
  - `src/components/crm/document-chat.tsx` — chat UI: user messages (right, blue), assistant messages (left, grey) with sources as FileText badges, "Show context" toggle revealing chunks with scores, typing indicator (3 animated dots), auto-scroll, Enter to send / Shift+Enter for newline, empty states for no-docs and no-messages
  - `src/components/crm/customer-tabs.tsx` — added "Ask" tab with `MessageCircleQuestion` icon rendering `<DocumentChat>`
  - `src/lib/services/__tests__/rag-service.test.ts` — 14 tests covering search filters, security, sorting, empty results, generateAnswer context formatting, source deduplication
  - `src/components/crm/__tests__/document-chat.test.tsx` — 16 tests covering all UI states and interactions
- **Deviations from plan:** None — all acceptance criteria met
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-02 13:15

**Check the changes:** http://localhost:3002/dashboard/crm/[any-customer-slug]

- [ ] Page loads without errors
- [ ] "Ask" tab visible with question-mark chat icon in CRM customer detail tabs
- [ ] Clicking "Ask" tab shows DocumentChat component
- [ ] If no documents: shows "No documents found" empty state with link to Documents page
- [ ] If documents exist: shows example questions and "Ask a question about [Customer]" prompt
- [ ] Type a question and press Enter — user message appears right-aligned (blue)
- [ ] Assistant response appears left-aligned (grey) after a moment
- [ ] Source badges visible below assistant response (document name + type)
- [ ] "Show context" toggle reveals retrieved chunks with relevance scores
- [ ] Clicking example question populates the input field
- [ ] Input clears after sending
- [ ] No console errors

### Actions for David

Check the URL above by navigating to any CRM customer detail page and clicking the "Ask" tab. You need `ANTHROPIC_API_KEY` set in `.env.local` for answer generation to work. Qdrant must be running at `QDRANT_URL` and Ollama at `OLLAMA_BASE_URL` for search to work.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_23-rag-chat-ui.md`

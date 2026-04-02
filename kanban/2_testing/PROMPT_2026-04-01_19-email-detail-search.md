# PROMPT 19: Email Detail View + Search

> **Phase 5 — Email/Gmail Integration (Prompt 19 of 24)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** with encrypted token storage, including `scopes` (text[]) array tracking granted OAuth scopes
- **Google OAuth flow** (from Prompt 07) with incremental scope support
- **Gmail service** (from Prompt 18) at `src/lib/services/gmail-service.ts` with `listMessages`, `listMessagesForCustomer`, `getGmailClient`
- **Gmail messages API** at `src/app/api/integrations/google/gmail/messages/route.ts`
- **Email tab component** (from Prompt 18) at `src/components/crm/email-tab.tsx` showing email list on CRM customer detail page
- **`GmailMessageMeta` type** defined in gmail-service.ts: `{ id, threadId, subject, from, to, date, snippet }`
- **`googleapis`** npm package is installed
- **Encryption utilities** at `src/lib/encryption.ts`
- **Integration service** at `src/lib/services/integration-service.ts`

## Task

### 1. Upgrade Gmail Scope Handling

**Modify:** `src/lib/services/gmail-service.ts`

- Add a helper: `hasFullAccess(scopes: string[]) → boolean`
  - Returns true if scopes include `https://www.googleapis.com/auth/gmail.readonly`
  - Returns false if only `https://www.googleapis.com/auth/gmail.metadata`
- This determines whether we can fetch full email bodies or only metadata

### 2. Create Email Detail API

**File:** `src/app/api/integrations/google/gmail/detail/[messageId]/route.ts`

```typescript
// GET ?integration_id=...
// 1. Verify authenticated user owns the integration
// 2. Decrypt access token, refresh if needed
// 3. Check scopes:
//    - If gmail.readonly: fetch with format: 'full'
//    - If gmail.metadata only: fetch with format: 'metadata'
// 4. Call gmail.users.messages.get(userId='me', id=messageId, format=...)
// 5. If full format:
//    - Parse MIME parts to extract text/plain and text/html body
//    - Extract attachment metadata: { filename, mimeType, size, attachmentId }
//    - Return: { subject, from, to, cc, date, body_text, body_html, attachments, hasFullAccess: true }
// 6. If metadata format:
//    - Return: { subject, from, to, date, snippet, hasFullAccess: false,
//               upgradeMessage: "Upgrade to full Gmail access to see email bodies" }
// 7. Handle errors: message not found (404), token expired (401)
```

MIME parsing logic:

- Walk the `payload.parts` array recursively
- Find parts with `mimeType: 'text/plain'` and `mimeType: 'text/html'`
- Base64url decode the `body.data` field
- For single-part messages (no `parts`), check `payload.body.data` directly
- Attachments: parts with a `filename` field — extract filename, mimeType, body.size, body.attachmentId

### 3. Create Email Detail Dialog Component

**File:** `src/components/crm/email-detail-dialog.tsx`

- Uses shadcn `Dialog` component
- Triggered by clicking an email row in the email-tab list
- Props: `messageId: string`, `integrationId: string`, `open: boolean`, `onOpenChange: (open: boolean) => void`
- On open: fetch from `/api/integrations/google/gmail/detail/[messageId]`
- Layout:
  - Header section: Subject (large), From, To, CC (if present), Date
  - Body section:
    - If `hasFullAccess` and `body_html`: render sanitised HTML in an iframe or via `dangerouslySetInnerHTML` with DOMPurify (install `dompurify` + `@types/dompurify`)
    - If `hasFullAccess` and only `body_text`: render in a `<pre>` with whitespace preserved
    - If not `hasFullAccess`: show snippet + upgrade message with link to Settings
  - Attachments section (if hasFullAccess):
    - List each attachment: icon based on mimeType, filename, human-readable size
    - Note: attachment download requires additional API call (out of scope, show name/size only)
  - Footer: "Open in Gmail" button, "Reply" button (placeholder — will work in Prompt 20)
- Loading state while fetching
- Error state if fetch fails

### 4. Create Email Search

**Modify:** `src/components/crm/email-tab.tsx`

- Add a search input at the top of the email tab (shadcn `Input` with search icon)
- Debounced: 500ms after typing stops, trigger search
- When search is active, use the search API instead of the regular listing API
- Clear button to return to regular listing

**File:** `src/app/api/integrations/google/gmail/search/route.ts`

```typescript
// GET ?q=...&integration_id=...&crm_customer_id=...&page_token=...
// 1. Verify authenticated user owns the integration
// 2. Decrypt access token, refresh if needed
// 3. Build Gmail query:
//    - Start with user's search term
//    - Scope to customer's contacts: AND (from:a@x.com OR to:a@x.com OR from:b@x.com OR to:b@x.com)
//    - This ensures search only returns emails related to this customer
// 4. Call listMessages with combined query
// 5. Return: { messages: GmailMessageMeta[], nextPageToken?: string }
```

Gmail search supports: `subject:`, `from:`, `has:attachment`, `after:YYYY/MM/DD`, `before:YYYY/MM/DD`, `is:starred`, etc.

### 5. Install DOMPurify

Run: `npm install dompurify @types/dompurify`

### 6. Write Vitest Tests

**File:** `src/lib/services/__tests__/gmail-service.test.ts` (add to existing)

Test:

- `hasFullAccess` returns true/false based on scopes

**File:** `src/app/api/integrations/google/gmail/detail/__tests__/route.test.ts`

Test:

- Full access: returns parsed body_html, body_text, attachments
- Metadata-only: returns snippet and upgrade message
- MIME parsing: handles multipart messages, single-part messages
- Base64url decoding works correctly

**File:** `src/components/crm/__tests__/email-detail-dialog.test.tsx`

Test:

- Renders email detail with full access (body, attachments)
- Renders metadata-only view with upgrade message
- Loading state shows while fetching
- "Open in Gmail" button renders
- Sanitised HTML rendering (no script tags)

**File:** `src/components/crm/__tests__/email-tab.test.tsx` (add to existing)

Test:

- Search input triggers debounced search
- Search results replace regular listing
- Clear search restores regular listing

## File Paths Summary

| Action  | Path                                                                   |
| ------- | ---------------------------------------------------------------------- |
| Create  | `src/app/api/integrations/google/gmail/detail/[messageId]/route.ts`    |
| Create  | `src/app/api/integrations/google/gmail/search/route.ts`                |
| Create  | `src/components/crm/email-detail-dialog.tsx`                           |
| Create  | `src/app/api/integrations/google/gmail/detail/__tests__/route.test.ts` |
| Create  | `src/components/crm/__tests__/email-detail-dialog.test.tsx`            |
| Modify  | `src/lib/services/gmail-service.ts` (add hasFullAccess helper)         |
| Modify  | `src/components/crm/email-tab.tsx` (add search input, click-to-detail) |
| Modify  | `src/components/crm/__tests__/email-tab.test.tsx` (add search tests)   |
| Modify  | `src/lib/services/__tests__/gmail-service.test.ts` (add scope tests)   |
| Install | `dompurify`, `@types/dompurify`                                        |

## Acceptance Criteria

- [ ] Full email detail shown when `gmail.readonly` scope is available
- [ ] Metadata-only view with upgrade message when only `gmail.metadata` scope
- [ ] MIME parsing correctly extracts text/plain and text/html bodies
- [ ] HTML body sanitised with DOMPurify before rendering (no XSS)
- [ ] Attachments listed with name, type, and size
- [ ] Search input on email tab with debounced query
- [ ] Search scoped to customer's contacts
- [ ] Gmail search query syntax supported (subject:, from:, etc.)
- [ ] Email detail dialog opens on row click
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] MIME parsing logic is sufficiently detailed for implementation
- [ ] DOMPurify used for HTML sanitisation (not raw dangerouslySetInnerHTML)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_19-email-detail-search.md`

---

## Implementation Notes — 2026-04-02 12:00

- **Commit:** bff4048 feat(prompt-19): email detail view + search with DOMPurify sanitisation
- **Tests:** 622 passed (63 test files), 0 failures
- **Verification URL:** http://localhost:3002 (CRM customer detail page, Email tab)
- **Playwright check:** N/A (no running instance for browser test)
- **Changes summary:**
  - Added `hasFullAccess(scopes)` helper to `gmail-service.ts`
  - Created email detail API at `src/app/api/integrations/google/gmail/detail/[messageId]/route.ts` with full MIME parsing (recursive multipart walk, base64url decoding, attachment extraction), scope-aware format selection (full vs metadata)
  - Created email search API at `src/app/api/integrations/google/gmail/search/route.ts` scoping user queries to customer contacts
  - Created `EmailDetailDialog` component with DOMPurify HTML sanitisation, scope-aware rendering (full body vs snippet + upgrade message), attachment listing with icons/sizes
  - Modified `email-tab.tsx` with debounced search input (500ms), clear button, click-to-detail on email rows
  - Installed `dompurify` + `@types/dompurify`
  - Added tests for: hasFullAccess, detail API (full/metadata/single-part/base64url), dialog component (full/metadata/loading/error/sanitisation), search (debounce/clear/restore)
- **Deviations from plan:** None
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-02 12:00

**Check the changes:** http://localhost:3002 (navigate to CRM customer detail > Email tab)

- [ ] Page loads without errors
- [ ] Search input appears at top of email tab
- [ ] Typing in search triggers debounced API call (check network tab)
- [ ] Search results replace regular listing
- [ ] Clear button restores regular email listing
- [ ] Clicking an email row opens detail dialog
- [ ] Full access: dialog shows HTML body, attachments with icons/sizes
- [ ] Metadata-only: dialog shows snippet + upgrade message with Settings link
- [ ] HTML body is sanitised (no script tags execute)
- [ ] "Open in Gmail" button links correctly
- [ ] No console errors

### Actions for David

Start the dev server (`npm run dev`) and navigate to a CRM customer with Gmail connected. Test the email search and click an email to verify the detail dialog renders correctly. If only metadata scope is granted, verify the upgrade message appears.

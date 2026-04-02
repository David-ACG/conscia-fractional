# PROMPT 18: Gmail Scope Addition + Email Listing Per Customer

> **Phase 5 — Email/Gmail Integration (Prompt 18 of 24)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** with encrypted token storage: `id`, `user_id`, `provider`, `account_identifier`, `access_token_encrypted`, `refresh_token_encrypted`, `token_expires_at`, `scopes` (text[]), `metadata` (jsonb), `is_active`, `created_at`, `updated_at`
- **Existing `crm_customers` table** with customer records
- **Existing `contacts` table** with `email` field linked to crm_customers
- **CRM customer detail pages** at `/dashboard/crm/[slug]` with a tabbed layout
- **Google OAuth flow** (from Prompt 07) stores `provider='google'` in integrations with encrypted access/refresh tokens
- **`googleapis`** npm package is installed
- **Encryption utilities** exist at `src/lib/encryption.ts` for encrypting/decrypting stored tokens
- **Integration service** at `src/lib/services/integration-service.ts` provides CRUD with transparent encryption
- **Settings page** at `src/app/(dashboard)/settings/page.tsx` already has a Google integration card

## Task

### 1. Add Gmail Metadata Scope to Google OAuth (Incremental)

**Modify:** `src/app/(dashboard)/settings/page.tsx` (or relevant settings component)

- Add an "Add Gmail Access" button visible when Google is connected but `gmail.metadata` scope is not in the integration's `scopes` array
- When clicked: redirect to Google OAuth with `prompt=consent` and `include_granted_scopes=true` to request the additional scope `https://www.googleapis.com/auth/gmail.metadata`
- This scope provides: subject, from, to, date, labels, snippet — NO body content
- Why metadata-only: avoids Google CASA security assessment ($15-75K cost)

**Modify:** Google OAuth callback handler (from Prompt 07) to:

- Merge new scopes with existing scopes on the integration record
- Update the access/refresh tokens with the new ones from the incremental auth

### 2. Create Gmail Service

**File:** `src/lib/services/gmail-service.ts`

```typescript
// Types:
// GmailMessageMeta {
//   id: string
//   threadId: string
//   subject: string
//   from: string
//   to: string
//   date: string       // ISO date string
//   snippet: string    // Gmail's auto-generated snippet
// }

// Functions:

// getGmailClient(accessToken: string) → gmail_v1.Gmail
//   - Creates authenticated Gmail client using googleapis

// listMessages(auth: gmail_v1.Gmail, query: string, maxResults?: number, pageToken?: string)
//   → { messages: GmailMessageMeta[], nextPageToken?: string }
//   - Uses gmail.users.messages.list to get message IDs matching query
//   - Then gmail.users.messages.get with format: 'metadata' and metadataHeaders: ['Subject', 'From', 'To', 'Date']
//   - Query format: "from:email@example.com OR to:email@example.com"
//   - Returns parsed metadata for each message
//   - Default maxResults: 20

// listMessagesForCustomer(auth: gmail_v1.Gmail, contacts: { email: string }[])
//   → { messages: GmailMessageMeta[], nextPageToken?: string }
//   - Builds query from all contact emails: "(from:a@x.com OR to:a@x.com OR from:b@x.com OR to:b@x.com)"
//   - Calls listMessages with combined query
//   - Returns unified, date-sorted list
```

### 3. Create API Route for Email Listing

**File:** `src/app/api/integrations/google/gmail/messages/route.ts`

```typescript
// GET ?crm_customer_id=...&integration_id=...&page_token=...
// 1. Verify authenticated user owns the integration
// 2. Verify integration has gmail.metadata or gmail.readonly scope
// 3. Decrypt access token, refresh if needed
// 4. Look up all contacts for the CRM customer
// 5. Call listMessagesForCustomer with contact emails
// 6. Return JSON: { messages: GmailMessageMeta[], nextPageToken?: string }
// 7. Handle errors: token expired (401), scope missing (403), no contacts (empty result)
```

### 4. Create Email Tab Component

**File:** `src/components/crm/email-tab.tsx`

- Tab content for the CRM customer detail page
- On mount: fetch emails from `/api/integrations/google/gmail/messages`
- If user has multiple Google integrations with Gmail scope, show a selector
- Display each email as a card/row:
  - Subject (bold)
  - From / To indicator (show direction: incoming vs outgoing based on whether from matches a contact)
  - Date (relative, e.g. "2 hours ago")
  - Snippet (truncated preview text)
  - "Open in Gmail" link: `https://mail.google.com/mail/u/0/#inbox/<messageId>`
- Sorted by date (newest first)
- "Load More" button using `nextPageToken` for pagination
- Loading skeleton while fetching
- **Empty state when no Gmail connected:**
  - "Connect Gmail to see emails"
  - "Connect Gmail" button → `/dashboard/settings`
- **Empty state when no emails found:**
  - "No emails found for this customer's contacts"

### 5. Add Email Tab to CRM Customer Detail Page

- Find the existing tabbed layout in the CRM detail page component
- Add an "Email" tab with a Mail icon (Lucide `Mail`)
- Tab renders `<EmailTab customerId={customer.id} />`

### 6. Write Vitest Tests

**File:** `src/lib/services/__tests__/gmail-service.test.ts`

Test:

- `listMessages` calls Gmail API with correct query and format
- `listMessagesForCustomer` builds correct OR query from multiple contact emails
- Metadata parsing extracts subject, from, to, date correctly
- Pagination token passed through correctly
- Error handling for API failures

**File:** `src/components/crm/__tests__/email-tab.test.tsx`

Test:

- Renders email list when data available
- Shows empty state when no Gmail connected
- Shows empty state when no emails
- Load More button triggers next page fetch
- "Open in Gmail" links render correctly
- Direction indicator (incoming/outgoing) works

## File Paths Summary

| Action | Path                                                             |
| ------ | ---------------------------------------------------------------- |
| Create | `src/lib/services/gmail-service.ts`                              |
| Create | `src/app/api/integrations/google/gmail/messages/route.ts`        |
| Create | `src/components/crm/email-tab.tsx`                               |
| Create | `src/lib/services/__tests__/gmail-service.test.ts`               |
| Create | `src/components/crm/__tests__/email-tab.test.tsx`                |
| Modify | `src/app/(dashboard)/settings/page.tsx` (add Gmail scope button) |
| Modify | Google OAuth callback handler (merge scopes on incremental auth) |
| Modify | CRM customer detail page component (add Email tab)               |

## Acceptance Criteria

- [ ] Gmail metadata scope added incrementally via "Add Gmail Access" button
- [ ] Email list fetched for all of a customer's contacts
- [ ] Metadata displayed: subject, from, to, date, snippet (no body content)
- [ ] Email tab visible on CRM detail page
- [ ] "Open in Gmail" links constructed correctly
- [ ] Pagination works with "Load More" button
- [ ] Multiple Google accounts handled (integration selector)
- [ ] Empty states render correctly (no Gmail, no emails)
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Gmail metadata scope correctly specified (not gmail.readonly)
- [ ] Incremental OAuth uses include_granted_scopes=true

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_18-gmail-scope-listing.md`

---

## Implementation Notes — 2026-04-02 11:35

- **Commit:** 98ffcc6 feat(prompt-18): Gmail scope addition + email listing per customer
- **Tests:** 599 passed (61 test files) — all passing
- **Verification URL:** http://localhost:3002/dashboard/crm/[slug] → Email tab
- **Playwright check:** N/A — no local server running; component and service tests pass
- **Changes summary:**
  - Created `src/lib/services/gmail-service.ts` — `getGmailClient`, `listMessages`, `listMessagesForCustomer`
  - Created `src/app/api/integrations/google/gmail/integrations/route.ts` — lists Gmail-scoped Google accounts for current user
  - Created `src/app/api/integrations/google/gmail/messages/route.ts` — fetches emails for all contacts of a CRM customer, returns contactEmails for direction indicator
  - Created `src/components/crm/email-tab.tsx` — EmailTab component with skeleton loading, Gmail empty state, no-emails empty state, incoming/outgoing direction indicator, "Open in Gmail" links, pagination (Load More), multi-account selector
  - Modified `src/app/(dashboard)/settings/google-integrations.tsx` — enabled "Add Gmail Access" button (was disabled with Coming in Phase 5 tooltip), removed unused Tooltip imports
  - Modified `src/components/crm/customer-tabs.tsx` — added Email tab with Mail icon
  - Created `src/lib/services/__tests__/gmail-service.test.ts` — tests for getGmailClient, listMessages (query/format, empty, metadata parsing, pagination, sorting, errors), listMessagesForCustomer (OR query, single contact, no contacts, pagination)
  - Created `src/components/crm/__tests__/email-tab.test.tsx` — tests for no-gmail empty state, no-emails empty state, email list rendering, Open in Gmail links, direction indicators, Load More pagination, multi-account selector
- **Deviations from plan:** None — OAuth callback already had include_granted_scopes=true and scope merging via storeTokens; no callback modification needed
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-02 11:35

**Check the changes:** http://localhost:3002/dashboard/settings and http://localhost:3002/dashboard/crm/[slug]

- [ ] Settings page loads without errors
- [ ] Connected Google account shows "Add Gmail Access" button (when gmail.metadata scope not yet granted)
- [ ] "Add Gmail Access" button redirects to Google OAuth consent screen
- [ ] After granting Gmail access, Gmail scope badge appears on the integration card
- [ ] CRM customer detail page shows "Email" tab with Mail icon
- [ ] Email tab shows "Connect Gmail" empty state when no Gmail integration exists
- [ ] Email tab shows emails with subject, from, date, snippet when Gmail connected and contacts exist
- [ ] "Open in Gmail" links open correct Gmail URLs
- [ ] Direction indicator (Incoming/Outgoing) shows correctly
- [ ] "Load More" button loads next page of results
- [ ] Multiple Google accounts show account selector dropdown
- [ ] No console errors

### Actions for David

1. Go to http://localhost:3002/dashboard/settings — confirm "Add Gmail Access" button is visible on your connected Google account
2. Click "Add Gmail Access" and grant the gmail.metadata scope in Google OAuth
3. Open a CRM customer with contacts that have email addresses
4. Click the new "Email" tab — should list emails to/from those contacts
5. Check "Open in Gmail" links open the correct messages

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_18-gmail-scope-listing.md`

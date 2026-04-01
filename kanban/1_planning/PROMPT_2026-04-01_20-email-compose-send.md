# PROMPT 20: Compose + Send Email from FractionalBuddy

> **Phase 5 — Email/Gmail Integration (Prompt 20 of 24)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** with encrypted token storage, including `scopes` (text[]) array tracking granted OAuth scopes
- **Google OAuth flow** (from Prompt 07) with incremental scope support (`include_granted_scopes=true`)
- **Gmail service** (from Prompt 18) at `src/lib/services/gmail-service.ts` with `listMessages`, `listMessagesForCustomer`, `getGmailClient`, `hasFullAccess`
- **Email tab** (from Prompt 18) at `src/components/crm/email-tab.tsx` with email list on CRM detail page
- **Email detail dialog** (from Prompt 19) at `src/components/crm/email-detail-dialog.tsx` with "Reply" button placeholder
- **`contacts` table** with `email` field linked to crm_customers
- **`googleapis`** npm package is installed
- **Encryption utilities** at `src/lib/encryption.ts`
- **Integration service** at `src/lib/services/integration-service.ts`
- **Settings page** at `src/app/(dashboard)/settings/page.tsx` with Google integration card

## Task

### 1. Add gmail.send Scope to Google OAuth (Incremental)

**Modify:** `src/app/(dashboard)/settings/page.tsx` (or relevant settings component)

- Add an "Add Email Send Access" button visible when Google is connected and has gmail.metadata (or gmail.readonly) scope but NOT `gmail.send` scope
- When clicked: redirect to Google OAuth with `prompt=consent`, `include_granted_scopes=true`, requesting additional scope `https://www.googleapis.com/auth/gmail.send`
- Show a note below the button: "Send access requires Google verification. Until verified, only test users can send."
- The OAuth callback handler (already updated in Prompt 18) will merge the new scope

### 2. Add Send Methods to Gmail Service

**Modify:** `src/lib/services/gmail-service.ts`

Add:

```typescript
// hasSendAccess(scopes: string[]) → boolean
//   - Returns true if scopes include 'https://www.googleapis.com/auth/gmail.send'

// sendEmail(auth: gmail_v1.Gmail, params: {
//   to: string,
//   cc?: string,
//   bcc?: string,
//   subject: string,
//   body: string,         // plain text body
//   threadId?: string,    // for threading (replies)
//   inReplyTo?: string,   // Message-ID header of email being replied to
//   references?: string,  // References header for threading
// }) → Promise<{ messageId: string }>
//
//   - Construct RFC 2822 MIME message:
//     Content-Type: text/plain; charset="UTF-8"
//     MIME-Version: 1.0
//     To: <to>
//     Cc: <cc> (if provided)
//     Bcc: <bcc> (if provided)
//     Subject: <subject>
//     In-Reply-To: <inReplyTo> (if replying)
//     References: <references> (if replying)
//     \n
//     <body>
//   - Base64url encode the raw message (Buffer.from(raw).toString('base64url'))
//   - Call gmail.users.messages.send({ userId: 'me', requestBody: { raw, threadId } })
//   - Return { messageId: response.data.id }

// createDraft(auth: gmail_v1.Gmail, params: {
//   to: string,
//   subject: string,
//   body: string,
//   threadId?: string,
// }) → Promise<{ draftId: string }>
//
//   - Construct same RFC 2822 message
//   - Base64url encode
//   - Call gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw, threadId } } })
//   - Return { draftId: response.data.id }
```

### 3. Create Send API Route

**File:** `src/app/api/integrations/google/gmail/send/route.ts`

```typescript
// POST body: { integration_id, to, cc?, bcc?, subject, body, thread_id?, in_reply_to?, references? }
// 1. Verify authenticated user owns the integration
// 2. Check integration scopes include gmail.send — if not, return 403 with message
// 3. Decrypt access token, refresh if needed
// 4. Call gmail-service.sendEmail with params
// 5. Return: { message_id: string }
// 6. Handle errors: scope missing (403), rate limit (429), invalid recipient (400)
```

### 4. Create Draft API Route

**File:** `src/app/api/integrations/google/gmail/draft/route.ts`

```typescript
// POST body: { integration_id, to, subject, body, thread_id? }
// 1. Verify authenticated user owns the integration
// 2. Check integration scopes include gmail.send (drafts also need send scope)
// 3. Decrypt access token, refresh if needed
// 4. Call gmail-service.createDraft with params
// 5. Return: { draft_id: string }
```

### 5. Create Compose Component

**File:** `src/components/crm/email-compose.tsx`

- Uses shadcn `Dialog` component
- Props: `customerId: string`, `open: boolean`, `onOpenChange`, plus optional reply context:
  - `replyTo?: { messageId: string, threadId: string, subject: string, from: string, snippet: string, inReplyTo?: string, references?: string }`
- Form fields:
  - **To**: Pre-populated from customer's contacts (dropdown/combobox if multiple contacts). If replying, pre-filled with the sender of the original email
  - **CC**: Optional text input
  - **Subject**: Text input. If replying, pre-filled with "Re: <original subject>"
  - **Body**: Plain text textarea. If replying, include quoted original snippet below a separator ("--- Original message ---")
  - **From**: If user has multiple Google integrations with gmail.send scope, show a selector for which account to send from
- Buttons:
  - "Send" — calls POST `/api/integrations/google/gmail/send`
  - "Save Draft" — calls POST `/api/integrations/google/gmail/draft`
  - "Cancel" — closes dialog
- On success: show toast notification, close dialog, refresh email list
- On error: show error toast with message
- Validation: To and Subject are required
- If no integration has gmail.send scope: show message with link to Settings to add send access

### 6. Integrate Compose into Email Tab and Detail Dialog

**Modify:** `src/components/crm/email-tab.tsx`

- Add a "Compose" button (Lucide `PenSquare` icon) at the top of the email tab next to search
- Clicking opens `<EmailCompose customerId={customerId} />`

**Modify:** `src/components/crm/email-detail-dialog.tsx`

- Wire up the "Reply" button (currently placeholder)
- On click: close detail dialog, open compose dialog with replyTo context populated from the current email detail

### 7. Write Vitest Tests

**File:** `src/lib/services/__tests__/gmail-service.test.ts` (add to existing)

Test:

- `hasSendAccess` returns true/false based on scopes
- `sendEmail` constructs correct RFC 2822 message with headers
- `sendEmail` with reply headers includes In-Reply-To and References
- `createDraft` calls correct Gmail API method
- Base64url encoding works correctly

**File:** `src/components/crm/__tests__/email-compose.test.tsx`

Test:

- Renders compose form with To pre-populated from contacts
- Reply mode pre-fills subject with "Re:" prefix
- Reply mode includes quoted original snippet
- Send button calls send API
- Save Draft button calls draft API
- Shows error when no gmail.send scope
- Validation prevents sending without To or Subject
- Success toast shown after send

## File Paths Summary

| Action | Path                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| Create | `src/app/api/integrations/google/gmail/send/route.ts`                           |
| Create | `src/app/api/integrations/google/gmail/draft/route.ts`                          |
| Create | `src/components/crm/email-compose.tsx`                                          |
| Create | `src/components/crm/__tests__/email-compose.test.tsx`                           |
| Modify | `src/lib/services/gmail-service.ts` (add sendEmail, createDraft, hasSendAccess) |
| Modify | `src/lib/services/__tests__/gmail-service.test.ts` (add send/draft tests)       |
| Modify | `src/app/(dashboard)/settings/page.tsx` (add gmail.send scope button)           |
| Modify | `src/components/crm/email-tab.tsx` (add Compose button)                         |
| Modify | `src/components/crm/email-detail-dialog.tsx` (wire Reply button)                |

## Acceptance Criteria

- [ ] `gmail.send` scope added incrementally via "Add Email Send Access" button
- [ ] Email sends via Gmail API with correct RFC 2822 format
- [ ] Threading works: replies include In-Reply-To, References headers and threadId
- [ ] Compose form pre-populates recipient from customer contacts
- [ ] Reply mode pre-fills subject ("Re:") and quotes original snippet
- [ ] Save Draft option creates draft in Gmail
- [ ] Scope validation: cannot send without gmail.send scope (403 returned)
- [ ] Multiple Google accounts handled (sender selector)
- [ ] Success/error toast notifications
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] RFC 2822 message construction is sufficiently detailed
- [ ] Reply threading headers (In-Reply-To, References) correctly specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_20-email-compose-send.md`

# PROMPT 1 of 3: Trello Auth Service + Settings UI

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_trello-task-export.md`
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind v4, shadcn/ui, Lucide, Vitest, Playwright
**Site URL:** http://localhost:3002

## Context

FractionalBuddy stores external integrations in a shared `integrations` table with AES-256-GCM-encrypted tokens. Slack and Google OAuth already live there. We're adding Trello. Trello does NOT support OAuth 2.0; we use Trello's **delegated token** flow (API key + user-pasted token) — much simpler than OAuth 1.0a and supported by their docs for server-side use.

**Convention reminders (see `CLAUDE.md`):**
- All server actions use `createAdminClient` (bypasses RLS).
- Encryption utilities at `src/lib/encryption.ts`.
- Integration helpers at `src/lib/services/integration-service.ts`.

## What to change

Add a Trello auth service and a Settings card that lets David connect/disconnect his Trello account. No task-export logic yet — that's Prompt 2.

## Specific Instructions

### 1. Create the auth service

**File:** `src/lib/services/trello-auth-service.ts`

Export these functions:

```typescript
type TrelloCredentials = { apiKey: string; token: string; username: string };

buildAuthorizeUrl(apiKey: string, returnUrl: string): string
  // https://trello.com/1/authorize?expiration=never&scope=read,write
  //   &response_type=token&name=FractionalBuddy&key={apiKey}&return_url={returnUrl}

fetchMemberInfo(apiKey: string, token: string): Promise<{ username: string; fullName: string }>
  // GET https://api.trello.com/1/members/me?key=...&token=...&fields=username,fullName
  // Throws on non-200.

storeCredentials(userId: string, apiKey: string, token: string, username: string): Promise<void>
  // Encrypt apiKey AND token separately.
  // Upsert into `integrations`:
  //   provider: 'trello'
  //   account_identifier: username
  //   encrypted_token: encrypt(token)
  //   metadata: { api_key_encrypted: encrypt(apiKey) }
  //   user_id: userId
  // Use createAdminClient.

getCredentials(userId: string): Promise<TrelloCredentials | null>
  // Load integration row for provider='trello'. Decrypt both fields. Return null if absent.

disconnect(userId: string): Promise<void>
  // Delete the integration row for provider='trello'.
```

### 2. Create the initiation route

**File:** `src/app/api/auth/trello/route.ts`

`POST` handler (form-submitted from the Settings card):

1. Parse `formData` — require `apiKey` (non-empty string).
2. Call `fetchMemberInfo(apiKey, 'bogus')` only to confirm the key is real? **No** — a key alone is valid without a token. Instead just validate it's a 32-char hex string (`/^[a-f0-9]{32}$/i`). If invalid, redirect to `/settings?trello=error&message=invalid_key`.
3. Set an httpOnly cookie `trello_pending_key` with the apiKey (expires in 10 min, `sameSite: 'lax'`, `secure` in prod).
4. Build the authorize URL with `returnUrl = ${NEXT_PUBLIC_SITE_URL}/api/auth/trello/callback` (fall back to `http://localhost:3002` if env var missing).
5. Return `NextResponse.redirect(authorizeUrl)`.

### 3. Create the callback route

**File:** `src/app/api/auth/trello/callback/route.ts`

`GET` handler:

1. Trello appends the token to the URL as a **fragment** (`#token=...`) by default when `response_type=token`. BUT the docs also accept query-string return — we'll support both by rendering a tiny inline HTML page that reads `window.location.hash`, strips the `#`, and POSTs back to `/api/auth/trello/callback` as `?token=...`. **Simpler**: set `return_url` with an extra `?_redir=1` marker, and when Trello redirects to that page with the token on the hash, client-side JS in a minimal HTML response extracts it and navigates to `?token=...`.

   Implementation:
   - If `request.nextUrl.searchParams.get('token')` is present → continue to step 2.
   - Otherwise → return an `NextResponse` with `Content-Type: text/html` containing:
     ```html
     <script>
       const p = new URLSearchParams(location.hash.slice(1));
       const t = p.get('token');
       if (t) location.href = location.pathname + '?token=' + encodeURIComponent(t);
       else location.href = '/settings?trello=error&message=no_token';
     </script>
     ```

2. Read `trello_pending_key` cookie. If missing, redirect to `/settings?trello=error&message=key_missing`.
3. Get the authed user via Supabase server client. If none, redirect to `/login`.
4. Call `fetchMemberInfo(apiKey, token)` — if it throws, redirect to `/settings?trello=error&message=trello_rejected`.
5. Call `storeCredentials(userId, apiKey, token, username)`.
6. Clear the `trello_pending_key` cookie.
7. Redirect to `/settings?trello=connected`.

### 4. Settings card

**File (Modify):** `src/app/(dashboard)/settings/page.tsx`

Add a Trello integration card alongside existing ones. Check for existing Trello integration via `getIntegration(user.id, 'trello')`.

- **Disconnected state** — render `<TrelloConnectForm />` (next step).
- **Connected state** — show Trello logo, `Connected as @{username}`, connected date, and a `<DisconnectButton provider="trello" />` (reuse existing component).
- Show success/error banner from `?trello=connected` / `?trello=error&message=...` similar to Slack handling.

**File (Create):** `src/components/settings/trello-connect-form.tsx`

Client component. Small form with:
- Label + input for "Trello API Key" (with helper text and external link to `https://trello.com/app-key` opening in new tab).
- Submit button "Connect Trello" — posts to `/api/auth/trello` using a plain HTML form (`method="POST"`).
- Validation: disable submit until input matches `/^[a-f0-9]{32}$/i`.

### 5. Environment example

**File (Modify):** `.env.local.example`

Add optional:
```
# Trello Integration (app-level metadata only — user provides their own API key)
TRELLO_APP_NAME=FractionalBuddy
```
(No `TRELLO_CLIENT_ID` / `SECRET` — we use delegated tokens, not OAuth.)

### 6. Types

**File (Modify):** `src/lib/types.ts`
- No new task-level field in this prompt (that's Prompt 2).
- If there's a shared `IntegrationProvider` union, add `'trello'`.

### 7. Vitest tests

**File (Create):** `src/lib/services/__tests__/trello-auth-service.test.ts`

Mock `src/lib/encryption.ts` and `src/lib/supabase/admin.ts`. Tests:
1. `buildAuthorizeUrl` returns URL with `response_type=token`, `scope=read,write`, `expiration=never`, correct `key` and `return_url`.
2. `fetchMemberInfo` calls `GET https://api.trello.com/1/members/me` with `key` + `token` + `fields` query params; throws on non-200; returns `{ username, fullName }` on 200.
3. `storeCredentials` calls `encrypt` twice (once for token, once for key), upserts with `provider='trello'` and correct shape of `metadata`.
4. `getCredentials` returns null when no row exists, returns decrypted shape when present.
5. `disconnect` deletes the row.

Aim for ≥95% coverage on the service.

## Files Likely Affected

- `src/lib/services/trello-auth-service.ts` — **Create**
- `src/app/api/auth/trello/route.ts` — **Create**
- `src/app/api/auth/trello/callback/route.ts` — **Create**
- `src/app/(dashboard)/settings/page.tsx` — **Modify**
- `src/components/settings/trello-connect-form.tsx` — **Create**
- `src/lib/services/__tests__/trello-auth-service.test.ts` — **Create**
- `.env.local.example` — **Modify**
- `src/lib/types.ts` — **Modify** (add `'trello'` to `IntegrationProvider` if such union exists)

## Acceptance criteria

- [ ] Settings page shows a Trello card with a form when not connected
- [ ] Form only enables submit when the API key matches `/^[a-f0-9]{32}$/i`
- [ ] Submitting the form POSTs to `/api/auth/trello`, which sets the `trello_pending_key` cookie and redirects to `trello.com/1/authorize` with correct query string
- [ ] `/api/auth/trello/callback` handles the fragment-token case (inline HTML script re-navigates with `?token=...`)
- [ ] After Trello redirects back, credentials are stored encrypted under `provider='trello'` with the resolved username as `account_identifier`
- [ ] Settings card shows "Connected as @{username}" + Disconnect button after connecting
- [ ] Disconnect removes the integration row and the card returns to the form state
- [ ] Error paths redirect to `/settings?trello=error&message=...` and display a red banner
- [ ] `npm test` passes; new tests cover all five service functions

## Notes

- No `NEXT_PUBLIC_` variables needed for Trello — the user brings their own key.
- Do NOT write logs that could contain the API key or token.
- The delegated-token flow is intentionally lightweight. If we later need bot-style automation across users, we will revisit OAuth 1.0a.
- The plan covers why we picked this over OAuth — see `RESEARCH_2026-04-17_trello-task-export.md` §3.

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-04-17 21:05

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project (`src/app/(dashboard)/settings/...`)
- [ ] Acceptance criteria match the plan's §Settings + Auth bullets
- [ ] The prompt doesn't introduce scope creep (no task export logic here)
- [ ] Delegated-token flow is handled correctly (fragment → query redirect trick)
- [ ] Encryption applied to BOTH api key and token
- [ ] No secrets logged

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_01-trello-auth-settings.md`

## Implementation Notes — 2026-04-17 17:35

- **Commit:** <pending — to be added after commit>
- **Tests:** 937/937 pass (14 new tests for `trello-auth-service` — `buildAuthorizeUrl`, `fetchMemberInfo`, `storeCredentials`, `getCredentials`, `disconnect`)
- **Verification URL:** https://localhost:3002/settings (HTTPS dev server)
- **Playwright check:** Passed — ad-hoc script verified the Trello card renders, Connect Trello button is disabled on empty input, disabled on invalid input, and enabled when a 32-char hex string is entered. No console errors.
- **Changes summary:**
  - Created `src/lib/services/trello-auth-service.ts` with `TrelloCredentials`, `buildAuthorizeUrl`, `fetchMemberInfo`, `storeCredentials`, `getCredentials`, `disconnect`. Uses `createAdminClient` and encrypts both API key (in `metadata.api_key_encrypted`) and token (in `access_token_encrypted`).
  - Created `POST /api/auth/trello` route — validates API key with `/^[a-f0-9]{32}$/i`, sets httpOnly `trello_pending_key` cookie (10 min, `sameSite=lax`, `secure` in prod), 303-redirects to `trello.com/1/authorize`.
  - Created `GET /api/auth/trello/callback` — inline HTML script extracts token from URL fragment and re-navigates with `?token=...`; then validates cookie, fetches member info, stores encrypted credentials, clears cookie, redirects to `/settings?trello=connected`.
  - Created `src/components/settings/trello-connect-form.tsx` — client component with live regex validation; submit button only enabled for valid 32-char hex keys.
  - Modified `src/app/(dashboard)/settings/page.tsx` — added Trello card with success/error banners for `?trello=connected|error` params and reuses existing `DisconnectButton` (soft-delete via `deleteIntegration`).
  - Modified `.env.local.example` — added optional `TRELLO_APP_NAME=FractionalBuddy`.
- **Deviations from plan:**
  - No `IntegrationProvider` union exists in `src/lib/types.ts`, so nothing to add there.
  - The existing `DisconnectButton` soft-deletes via `is_active=false` (project convention). The prompt's `disconnect()` function hard-deletes as specified, but the Settings UI uses the existing soft-delete path for consistency with other integrations. If hard-delete is required, wire the card to a new server action that calls `disconnect()` instead.
  - `storeCredentials` writes into the real column `access_token_encrypted` (not a literal `encrypted_token` column — that was pseudo-code in the prompt).
- **Follow-up issues:** None. Ready for Prompt 2 (task export service).

## Testing Checklist — 2026-04-17 17:35

**Check the changes:** https://localhost:3002/settings

- [ ] Page loads without errors
- [ ] "Trello" card appears with a "Not Connected" badge and an API key input field
- [ ] "Connect Trello" button is **disabled** until the input contains exactly 32 hex characters (a-f, 0-9)
- [ ] Clicking `trello.com/app-key` link opens Trello's API key page in a new tab
- [ ] Submitting with a valid key redirects to `trello.com/1/authorize` (it will ask you to grant FractionalBuddy `read,write` with no expiration)
- [ ] After granting, you land back on `/settings?trello=connected` with a green "Trello connected successfully." banner
- [ ] Card now shows "Connected as @{your-trello-username}" and a connected date
- [ ] Clicking "Disconnect" removes the card's connected state and brings the form back
- [ ] If you cancel on Trello's page (no token), the callback redirects to `/settings?trello=error&message=no_token`
- [ ] Light/dark mode: both modes render the card correctly
- [ ] No console errors in the browser DevTools

### Actions for David

1. Visit `https://trello.com/app-key` and copy your personal API key (the 32-char hex string under "Power-Ups and Integrations > API Key").
2. Navigate to https://localhost:3002/settings
3. Paste the key into the Trello card's input field — button should enable
4. Click "Connect Trello" — follow the Trello consent screen
5. Verify you land back on Settings with "Connected as @yourname"
6. Tick the checklist items above
7. When ready, move on to Prompt 2 (task export service)

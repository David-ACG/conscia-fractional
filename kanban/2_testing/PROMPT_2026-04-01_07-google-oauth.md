# PROMPT 07: Google OAuth2 Flow (Consent Screen, Callback, Token Storage)

**Date:** 2026-04-01
**Plan Reference:** PLAN_2026-04-01_integrations-meeting-recording.md (Phase 2: Google Drive)

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application for fractional executives. It uses Supabase for auth and DB (PostgreSQL with RLS), Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons for UI. All server actions use `createAdminClient` (synchronous, bypasses RLS). Site runs at http://localhost:3002.

This prompt implements the Google OAuth2 flow that underpins all Google integrations (Drive, Calendar, Gmail). Users connect one or more Google accounts, and tokens are stored encrypted in the `integrations` table.

**DEPENDS ON:** Prompt 01 (integrations table + settings page + encryption) must be completed first. That prompt creates:

- `integrations` table in Supabase with columns: id, user_id, provider, account_identifier, access_token, refresh_token, token_expires_at, scopes, metadata, created_at, updated_at
- Settings page at `/dashboard/settings` with an Integrations section
- Encryption utilities at `src/lib/encryption.ts` with `encrypt(plaintext)` and `decrypt(ciphertext)` functions using `ENCRYPTION_KEY` env var

## Task

### 1. Install googleapis npm package

```bash
npm install googleapis
```

### 2. Create Google OAuth service at `src/lib/services/google-auth-service.ts`

```typescript
// Environment variables used:
// GOOGLE_CLIENT_ID — from Google Cloud Console
// GOOGLE_CLIENT_SECRET — from Google Cloud Console
// GOOGLE_REDIRECT_URI — http://localhost:3002/api/auth/google/callback

import { google } from "googleapis";
import { encrypt, decrypt } from "@/lib/encryption";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
```

Implement the following functions:

- **`createOAuth2Client()`** — Returns a configured `google.auth.OAuth2` instance using env vars. Throw a clear error if any env var is missing.

- **`generateAuthUrl(scopes: string[], state: string)`** — Returns a Google consent URL
  - `access_type: 'offline'` (to get refresh_token)
  - `prompt: 'consent'` (always show consent screen to ensure refresh_token is returned)
  - `include_granted_scopes: true` (incremental authorisation)
  - `state` parameter for CSRF protection
  - Initial scope for this phase: `'https://www.googleapis.com/auth/drive.readonly'`
  - Future phases will add: `'https://www.googleapis.com/auth/calendar.readonly'`, `'https://www.googleapis.com/auth/gmail.metadata'`

- **`exchangeCode(code: string)`** — Exchanges auth code for tokens
  - Returns `{ access_token, refresh_token, expiry_date, scope }`
  - Throw if exchange fails with descriptive error

- **`refreshAccessToken(refreshToken: string)`** — Refreshes an expired access token
  - Decrypts the stored refresh token first
  - Returns `{ access_token, expiry_date }`
  - If refresh fails (token revoked), throw a specific error so caller can prompt re-auth

- **`getGoogleUserEmail(accessToken: string)`** — Gets the Google account email
  - Uses `google.oauth2('v2').userinfo.get()` or the tokeninfo endpoint
  - Returns the email string

- **`storeTokens(userId: string, email: string, tokens: { access_token, refresh_token, expiry_date, scope })`** — Upserts into integrations table
  - Encrypts `access_token` and `refresh_token` before storage
  - Provider = 'google'
  - Account identifier = email
  - Parses scope string into `scopes` text array
  - Uses `createAdminClient` (synchronous — no await)
  - Upsert on (user_id, provider, account_identifier) — if same Google account reconnected, update tokens

- **`getValidAccessToken(integrationId: string)`** — Gets a valid (non-expired) access token
  - Fetches integration record by ID
  - If token not expired, decrypt and return access_token
  - If expired, call refreshAccessToken, store new tokens, return new access_token
  - Buffer: treat as expired if within 5 minutes of expiry

- **`removeIntegration(integrationId: string, userId: string)`** — Deletes integration record
  - Verify the integration belongs to the user before deleting
  - Uses `createAdminClient`

### 3. Create OAuth callback route at `src/app/api/auth/google/callback/route.ts`

GET handler that:

1. Reads `code` and `state` query parameters
2. Validates `state` against the cookie set during initiation (CSRF check)
3. Clears the state cookie
4. Calls `exchangeCode(code)` to get tokens
5. Calls `getGoogleUserEmail(access_token)` to get the account email
6. Gets the authenticated user from Supabase (use `createClient` from `@/lib/supabase/server` for auth context)
7. Calls `storeTokens(userId, email, tokens)` to save encrypted tokens
8. Redirects to `/dashboard/settings?google=connected&email={email}`
9. Error handling:
   - Missing code → redirect to `/dashboard/settings?error=missing_code`
   - Invalid state → redirect to `/dashboard/settings?error=invalid_state`
   - Exchange fails → redirect to `/dashboard/settings?error=exchange_failed`
   - Missing refresh token → redirect to `/dashboard/settings?error=no_refresh_token` (happens if user previously granted access without revoking first)
   - Any other error → redirect to `/dashboard/settings?error=unknown`

**Pattern for getting auth user in API route:**

```typescript
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  // ... rest of handler
}
```

### 4. Create OAuth initiation route at `src/app/api/auth/google/route.ts`

GET handler that:

1. Gets authenticated user (redirect to /login if not authenticated)
2. Reads optional `scopes` query parameter (comma-separated list of scope suffixes like `drive.readonly,calendar.readonly`)
3. Converts scope suffixes to full Google API scope URLs
4. Generates a random `state` string (use `crypto.randomUUID()`)
5. Sets `state` in an HttpOnly cookie (name: `google_oauth_state`, max-age: 600 seconds, sameSite: 'lax', path: '/')
6. Generates auth URL via `generateAuthUrl(scopes, state)`
7. Redirects to the Google consent URL

Default scope if none provided: `drive.readonly`

### 5. Update Settings page (from Prompt 01)

Find the Settings page component and update the Google integration card in the Integrations section:

**When no Google account connected:**

- Card shows Google icon (use a simple SVG or the `Chrome` Lucide icon as placeholder), "Google" title, "Connect your Google account to access Drive, Calendar, and Gmail" description
- "Connect Google" button that links to `/api/auth/google?scopes=drive.readonly`

**When Google account(s) connected:**

- List each connected account showing:
  - Email address (account_identifier)
  - Connected date (created_at, formatted as relative time e.g. "Connected 2 days ago")
  - Granted scopes as badges (e.g. "Drive" badge if drive.readonly in scopes)
  - "Add Calendar Access" button — disabled, with tooltip "Coming in Phase 4"
  - "Add Gmail Access" button — disabled, with tooltip "Coming in Phase 5"
  - "Disconnect" button (red, with confirmation dialog) — calls a server action that invokes `removeIntegration`
- "+ Connect Another Account" button at bottom

**Success/error feedback:**

- Read `?google=connected&email=...` from URL → show success toast "Google account {email} connected"
- Read `?error=...` from URL → show error toast with human-readable message

**Server action for disconnecting:**
Create `src/lib/actions/integrations.ts`:

```typescript
"use server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
// removeGoogleIntegration(integrationId: string) — deletes the record
```

### 6. Add to .env.local.example

Append these lines:

```
# Google OAuth2
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3002/api/auth/google/callback
```

### 7. Write Vitest tests

Create `src/lib/services/__tests__/google-auth-service.test.ts`:

- Mock `googleapis` module
- Test `generateAuthUrl` returns URL with correct scopes and state
- Test `exchangeCode` calls OAuth2 client correctly
- Test `refreshAccessToken` decrypts refresh token and calls refresh
- Test `getValidAccessToken` returns cached token if not expired
- Test `getValidAccessToken` refreshes if expired
- Test `storeTokens` encrypts tokens before storing
- Test `removeIntegration` verifies user ownership

Create `src/app/api/auth/google/__tests__/callback.test.ts`:

- Test successful callback stores tokens and redirects
- Test missing code redirects with error
- Test invalid state redirects with error

## Files to Create

- `src/lib/services/google-auth-service.ts`
- `src/app/api/auth/google/route.ts`
- `src/app/api/auth/google/callback/route.ts`
- `src/lib/actions/integrations.ts`
- `src/lib/services/__tests__/google-auth-service.test.ts`
- `src/app/api/auth/google/__tests__/callback.test.ts`

## Files to Modify

- `package.json` (add googleapis dependency)
- `.env.local.example` (add Google OAuth env vars)
- Settings page component (from Prompt 01 — location TBD, likely `src/app/(dashboard)/settings/page.tsx` or a component it imports)

## Files to Reference (read patterns from)

- `src/lib/supabase/admin.ts` — createAdminClient pattern (synchronous, no await)
- `src/lib/supabase/server.ts` — createClient for auth context in API routes
- `src/lib/encryption.ts` — encrypt/decrypt functions (from Prompt 01)
- Existing API routes for pattern reference

## Acceptance Criteria

- [ ] `googleapis` installed and in package.json
- [ ] OAuth flow redirects to Google consent screen with correct scopes
- [ ] Callback exchanges code and stores encrypted tokens in integrations table
- [ ] Multiple Google accounts can be connected (different emails)
- [ ] Token refresh works automatically when access token is expired
- [ ] Settings page shows connected Google accounts with email, date, scope badges
- [ ] "Disconnect" removes the integration record with confirmation dialog
- [ ] CSRF protection via state parameter in cookie
- [ ] Error states handled gracefully with user-friendly messages
- [ ] All new tests pass
- [ ] All existing tests pass (`npm test`)

## Notes

- The Google Cloud project and OAuth consent screen must be configured manually in Google Cloud Console. This prompt only builds the application code.
- For local development, the consent screen must be in "Testing" mode with David's Google accounts added as test users.
- `prompt: 'consent'` is important — without it, Google may not return a refresh_token on subsequent authorisations.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Encryption dependency on Prompt 01 is clearly stated
- [ ] OAuth security measures (CSRF, HttpOnly cookies) are specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_07-google-oauth.md`

---

## Implementation Notes — 2026-04-01 21:42

- **Commit:** (see git log — uncommitted)
- **Tests:** 343 passed (39 test files) — all new tests pass, all existing tests pass
- **Verification URL:** http://localhost:3002/dashboard/settings (requires local server)
- **Playwright check:** N/A — no running server in build context
- **Changes summary:**
  - Installed `googleapis@^171.4.0`
  - Created `src/lib/services/google-auth-service.ts` — OAuth2 flow service (createOAuth2Client, generateAuthUrl, exchangeCode, refreshAccessToken, getGoogleUserEmail, storeTokens, getValidAccessToken, removeIntegration)
  - Created `src/app/api/auth/google/route.ts` — initiates OAuth flow, sets CSRF state cookie
  - Created `src/app/api/auth/google/callback/route.ts` — exchanges code, stores tokens, redirects to settings
  - Updated `src/lib/actions/integrations.ts` — added `removeGoogleIntegration` server action
  - Created `src/app/(dashboard)/settings/google-integrations.tsx` — client component for Google accounts section (multi-account, scope badges, disconnect confirmation dialog, toast notifications)
  - Updated `src/app/(dashboard)/settings/page.tsx` — Google card now uses GoogleIntegrationsSection, supports multiple accounts
  - Added `src/components/ui/alert-dialog.tsx` via shadcn (for disconnect confirmation)
  - Updated `.env.local.example` — added GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
  - Created `src/lib/services/__tests__/google-auth-service.test.ts` — 10 tests
  - Created `src/app/api/auth/google/__tests__/callback.test.ts` — 6 tests
- **Deviations from plan:** `removeGoogleIntegration` delegates to `removeIntegration` from google-auth-service; `integrations.ts` already existed with `disconnectIntegration` so `removeGoogleIntegration` was added alongside it
- **Follow-up issues:** Google Cloud Console setup (OAuth consent screen, credentials) must be done manually before the flow can be tested end-to-end

---

## Testing Checklist — 2026-04-01 21:42

**Check the changes:** http://localhost:3002/dashboard/settings

- [ ] Page loads without errors
- [ ] Google card shows "Not Connected" state with "Connect Google" button
- [ ] Clicking "Connect Google" redirects to Google OAuth consent screen (requires GOOGLE_CLIENT_ID etc. in .env.local)
- [ ] After connecting, email appears in the Google card with scope badge (Drive)
- [ ] "Disconnect" button shows confirmation dialog before removing
- [ ] Multiple Google accounts can be connected (different emails show as separate rows)
- [ ] Success toast appears after connecting: "Google account {email} connected"
- [ ] Error URL params show human-readable error toasts
- [ ] "Add Calendar Access" and "Add Gmail Access" buttons are disabled with tooltip "Coming in Phase 4/5"
- [ ] No console errors

### Actions for David

1. Add Google OAuth credentials to `.env.local` (copy from `.env.local.example`, fill in GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
2. In Google Cloud Console: create OAuth 2.0 credentials, set redirect URI to `http://localhost:3002/api/auth/google/callback`, add your email as a test user on the OAuth consent screen
3. Start the dev server: `npm run dev`
4. Navigate to http://localhost:3002/dashboard/settings
5. Tick the boxes above as you verify each item

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-01_07-google-oauth.md`

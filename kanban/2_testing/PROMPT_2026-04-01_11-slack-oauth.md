# PROMPT 11: Slack App OAuth Flow + Token Storage

> **Phase 3 — Slack Integration (Prompt 11 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** (from Prompt 01) with encrypted token storage: `id`, `user_id`, `provider` (text), `account_identifier` (text), `encrypted_token` (text), `metadata` (jsonb), `created_at`, `updated_at`
- **Existing Google OAuth flow** (from Prompt 07) — use as reference for patterns
- **Settings page** at `src/app/dashboard/settings/page.tsx` with integration management
- **Encryption utilities** already exist for token storage (used by Google integration)

## Task

### 1. Install @slack/web-api

```bash
npm install @slack/web-api
```

This is the lightweight Slack SDK — no Bolt framework needed at this stage.

### 2. Create Slack OAuth Service

**File:** `src/lib/services/slack-auth-service.ts`

```typescript
// Environment variables needed:
// SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI, SLACK_SIGNING_SECRET

// Functions:
// generateAuthUrl(state: string) → string
//   - OAuth URL: https://slack.com/oauth/v2/authorize
//   - Bot scopes: channels:read, chat:write, groups:read
//   - User scopes: search:read (for message search later)
//   - Include state parameter for CSRF protection
//
// exchangeCode(code: string) → { bot_token, user_token, team_name, team_id }
//   - POST to https://slack.com/api/oauth.v2.access
//   - body: client_id, client_secret, code, redirect_uri
//   - Extract authed_user.access_token (user token) and access_token (bot token)
//
// storeTokens(userId, botToken, userToken, teamName, teamId) → void
//   - Encrypt both tokens using existing encryption utilities
//   - Upsert into integrations table:
//     - provider: 'slack'
//     - account_identifier: teamName
//     - encrypted_token: botToken (encrypted)
//     - metadata: { team_id, user_token_encrypted: encrypt(userToken) }
//   - Use createAdminClient for DB operations
```

### 3. Create OAuth Callback Route

**File:** `src/app/api/auth/slack/callback/route.ts`

```typescript
// GET handler
// 1. Extract ?code=... and ?state=... from URL
// 2. Validate state parameter against stored CSRF token
// 3. Call exchangeCode(code)
// 4. Get authenticated user from Supabase
// 5. Call storeTokens(userId, botToken, userToken, teamName, teamId)
// 6. Redirect to /dashboard/settings?slack=connected
// 7. Error handling: redirect to /dashboard/settings?slack=error&message=... on failure
```

### 4. Create OAuth Initiation Route

**File:** `src/app/api/auth/slack/route.ts`

```typescript
// GET handler
// 1. Generate random state parameter
// 2. Store state in cookie or session for CSRF validation
// 3. Generate auth URL with state
// 4. Redirect to Slack OAuth consent page
```

### 5. Update Settings Page

Update the Settings page to include a Slack integration card:

- When not connected: "Connect Slack" button that links to `/api/auth/slack`
- When connected: show workspace name (from `account_identifier`), connected date
- "Disconnect" button that deletes the integration record
- Use the same card pattern as existing Google integration
- Slack icon from Lucide or an inline SVG

### 6. Update .env.local.example

Add these lines:

```
# Slack Integration
SLACK_CLIENT_ID=
SLACK_CLIENT_SECRET=
SLACK_REDIRECT_URI=http://localhost:3002/api/auth/slack/callback
SLACK_SIGNING_SECRET=
```

### 7. Write Vitest Tests

**File:** `src/lib/services/__tests__/slack-auth-service.test.ts`

Test:

- `generateAuthUrl` returns correct URL with all scopes
- `exchangeCode` makes correct API call and extracts tokens
- `storeTokens` encrypts and stores correctly
- Error handling for failed OAuth exchange
- Missing environment variables throw descriptive errors

## File Paths Summary

| Action | Path                                                    |
| ------ | ------------------------------------------------------- |
| Create | `src/lib/services/slack-auth-service.ts`                |
| Create | `src/app/api/auth/slack/route.ts`                       |
| Create | `src/app/api/auth/slack/callback/route.ts`              |
| Create | `src/lib/services/__tests__/slack-auth-service.test.ts` |
| Modify | `src/app/dashboard/settings/page.tsx` (add Slack card)  |
| Modify | `.env.local.example` (add Slack vars)                   |

## Acceptance Criteria

- [ ] `@slack/web-api` installed and in package.json
- [ ] OAuth flow redirects to Slack consent with correct bot + user scopes
- [ ] Callback exchanges code and stores encrypted bot + user tokens in integrations table
- [ ] Settings page shows "Connect Slack" button when disconnected
- [ ] Settings page shows workspace name and connected date when connected
- [ ] "Disconnect" button removes the Slack integration
- [ ] CSRF protection via state parameter
- [ ] .env.local.example updated with Slack vars
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] OAuth scopes match what's needed for Prompts 12-14

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_11-slack-oauth.md`

---

## Implementation Notes — 2026-04-01 22:18

- **Commit:** pending
- **Tests:** 439 passed / 0 failed (47 test files, includes 10 new Slack tests)
- **Verification URL:** http://localhost:3002/dashboard/settings
- **Playwright check:** not applicable (no running dev server in build context)
- **Changes summary:**
  - Installed `@slack/web-api` package
  - Created `src/lib/services/slack-auth-service.ts` — `generateAuthUrl`, `exchangeCode`, `storeTokens` functions
  - Created `src/app/api/auth/slack/route.ts` — OAuth initiation with CSRF state cookie
  - Created `src/app/api/auth/slack/callback/route.ts` — code exchange, token storage, redirect
  - Updated `src/app/(dashboard)/settings/page.tsx` — Slack card now has functional "Connect Slack" link, success/error inline feedback, connected workspace name + date
  - Updated `.env.local.example` — added SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI, SLACK_SIGNING_SECRET
  - Created `src/lib/services/__tests__/slack-auth-service.test.ts` — 10 tests covering all functions
- **Deviations from plan:** None
- **Follow-up issues:** SLACK_SIGNING_SECRET not used yet (reserved for webhook signature verification in future prompts)

---

## Testing Checklist — 2026-04-01 22:18

**Check the changes:** http://localhost:3002/dashboard/settings

- [ ] Page loads without errors
- [ ] Slack card shows "Connect Slack" button (not disabled) when disconnected
- [ ] Clicking "Connect Slack" redirects to `/api/auth/slack` (requires Slack app credentials in .env)
- [ ] After connecting, workspace name and connected date are visible
- [ ] "Disconnect" button removes the Slack integration
- [ ] Error message appears when OAuth fails (test by visiting `/dashboard/settings?slack=error&message=test_error`)
- [ ] No console errors

### Actions for David

1. Add real Slack app credentials to `.env.local` (copy from `.env.local.example` and fill in SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI, SLACK_SIGNING_SECRET from your Slack app settings at api.slack.com)
2. Visit http://localhost:3002/dashboard/settings and verify the Slack card shows a "Connect Slack" button
3. Tick the checklist boxes above

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_11-slack-oauth.md`

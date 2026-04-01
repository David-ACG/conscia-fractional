# PROMPT 14: Slack Search + Reaction-to-Task Event Handling

> **Phase 3 — Slack Integration (Prompt 14 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing tables:**
  - `integrations` — encrypted token storage (`provider`, `account_identifier`, `encrypted_token`, `metadata` jsonb including `team_id`, `user_token_encrypted`)
  - `crm_customers` — customer records
  - `tasks` — task records with `title`, `description`, `crm_customer_id`, `source` (text), `status`
  - `slack_channel_mappings` — (from Prompt 12) maps `channel_id` to `crm_customer_id` per `integration_id`
- **Existing Slack service** at `src/lib/services/slack-service.ts` (from Prompts 12-13) with:
  - `listChannels`, `getChannelMessages`, `searchMessages`
  - `postMessage`, `formatMeetingSummary`, `formatTaskUpdate`
- **Slack OAuth** stores both bot token (encrypted_token) and user token (metadata.user_token_encrypted)
- **`@slack/web-api`** is installed
- **Encryption utilities** exist for decrypting stored tokens
- **Slack messages tab** exists on CRM customer detail page (from Prompt 12)
- **Environment variable `SLACK_SIGNING_SECRET`** is configured (from Prompt 11)

## Task

### 1. Create Search API Route

**File:** `src/app/api/integrations/slack/search/route.ts`

```typescript
// GET ?q=...&integration_id=...&page=1&per_page=20
//
// 1. Verify authenticated user owns the integration
// 2. Decrypt user token from integrations.metadata.user_token_encrypted
//    (search.messages requires user token, NOT bot token)
// 3. Call searchMessages(userToken, query)
// 4. Return JSON:
//    {
//      messages: SlackMessage[],  // { ts, user, user_name, text, permalink, channel_name }
//      total: number,
//      page: number,
//      has_more: boolean
//    }
// 5. Error handling: return 500 with error message on Slack API failure
```

### 2. Create Slack Search Component

**File:** `src/components/crm/slack-search.tsx`

- Renders within the Slack messages tab on the CRM customer detail page
- Search input with magnifying glass icon (Lucide `Search`)
- Debounced search (300ms) — don't fire on every keystroke
- Results displayed below input:
  - Each result: sender name (bold), text preview, date, channel name
  - "Open in Slack" button/link per result (using permalink)
- Loading spinner during search
- "No results found" empty state
- Pagination: "Load more" button if has_more is true
- Optional toggle: "Search all channels" vs "Search mapped channel only"
  - Default: search mapped channel only (scoped to the customer's channel)
  - When toggled: search all channels in the workspace

Integrate into the existing `slack-messages-tab.tsx`:

- Add search component above the message list
- Collapsible or always-visible (use shadcn Collapsible or just show it)

### 3. Create Webhook Route for Slack Events

**File:** `src/app/api/webhooks/slack/events/route.ts`

```typescript
// POST handler for Slack Events API
//
// IMPORTANT: Slack requires a 200 response within 3 seconds. Do NOT do heavy
// processing before responding. Acknowledge first, then process.
//
// Step 1: Read raw body for signature verification
//   - Get X-Slack-Signature and X-Slack-Request-Timestamp headers
//   - Verify timestamp is within 5 minutes (replay protection)
//   - Compute HMAC-SHA256: v0=hmac_sha256(SLACK_SIGNING_SECRET, `v0:${timestamp}:${rawBody}`)
//   - Compare with X-Slack-Signature using timingSafeEqual
//   - Return 401 if verification fails
//
// Step 2: Handle url_verification challenge
//   - If body.type === 'url_verification', return { challenge: body.challenge }
//   - This is required when first configuring the Events API URL in Slack
//
// Step 3: Handle events
//   - If body.type === 'event_callback':
//     - If body.event.type === 'reaction_added':
//       - Check if reaction matches configured emoji (default: 'white_check_mark' which is ✅)
//       - Get the message that was reacted to:
//         - body.event.item.channel (channel ID)
//         - body.event.item.ts (message timestamp)
//       - Look up channel mapping to find crm_customer_id
//       - Look up integration by team_id (body.team_id)
//       - Fetch the original message text using conversations.history(channel, latest=ts, limit=1, inclusive=true)
//       - Create a task:
//         - title: first 100 chars of message text
//         - description: full message text + "\n\nSlack permalink: {permalink}"
//         - source: 'slack'
//         - crm_customer_id: from channel mapping
//         - user_id: from integration record
//       - Post a confirmation message to the channel: "Task created: {title}"
//
// Step 4: Always return 200 OK (even for unhandled events)
//
// SECURITY: This route must NOT require Supabase auth — it's called by Slack servers.
// Authentication is done via signing secret verification only.
```

**Signature verification helper** (can be in the same file or extracted):

```typescript
// verifySlackSignature(signingSecret: string, signature: string, timestamp: string, body: string) → boolean
//   - Use crypto.timingSafeEqual for constant-time comparison
//   - Use crypto.createHmac('sha256', signingSecret)
```

### 4. Add Configurable Reaction Emoji to Settings

Modify the Slack section of the Settings page (below notification toggles from Prompt 13):

- Label: "Create task from Slack reaction"
- Emoji picker or text input for the reaction emoji name
  - Default: `white_check_mark` (renders as ✅ in Slack)
  - Common alternatives: `todo`, `task`, `heavy_check_mark`
  - Simple text input with hint: "Enter Slack emoji name without colons"
- Store in `integrations.metadata.task_reaction_emoji`
- The webhook checks this value (falls back to `white_check_mark` if not set)

### 5. Write Vitest Tests

**File:** `src/app/api/webhooks/slack/events/__tests__/route.test.ts`

Test:

- Signature verification rejects invalid signatures
- Signature verification rejects old timestamps (>5 min)
- url_verification challenge returns correct response
- reaction_added with matching emoji creates a task
- reaction_added with non-matching emoji is ignored
- Task is created with correct title (truncated to 100 chars), description, source, customer
- Returns 200 for unhandled event types
- Returns 401 for missing/invalid signature

**File:** `src/components/crm/__tests__/slack-search.test.tsx`

Test:

- Search input debounces API calls
- Results render with sender, text, permalink
- "Open in Slack" links are correct
- Empty state shows when no results
- Loading state shows during search
- "Load more" button appears when has_more is true

## File Paths Summary

| Action | Path                                                               |
| ------ | ------------------------------------------------------------------ |
| Create | `src/app/api/integrations/slack/search/route.ts`                   |
| Create | `src/components/crm/slack-search.tsx`                              |
| Create | `src/app/api/webhooks/slack/events/route.ts`                       |
| Create | `src/app/api/webhooks/slack/events/__tests__/route.test.ts`        |
| Create | `src/components/crm/__tests__/slack-search.test.tsx`               |
| Modify | `src/components/crm/slack-messages-tab.tsx` (add search component) |
| Modify | `src/app/dashboard/settings/page.tsx` (add reaction emoji config)  |

## Acceptance Criteria

- [ ] Search API returns relevant Slack messages with pagination
- [ ] Search component debounces input and displays results
- [ ] "Open in Slack" permalink links work on search results
- [ ] Webhook verifies Slack signatures using HMAC-SHA256 + timingSafeEqual
- [ ] url_verification challenge is handled correctly
- [ ] Reaction with matching emoji (default ✅) creates a task in FractionalBuddy
- [ ] Created task has correct title (first 100 chars), description (full text + permalink), source='slack'
- [ ] Task is linked to correct CRM customer via channel mapping
- [ ] Configurable reaction emoji stored in integration metadata
- [ ] Webhook always responds 200 within 3 seconds
- [ ] Webhook returns 401 for invalid signatures
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Webhook security (signing secret verification) is clearly specified
- [ ] User token vs bot token usage is correct per Slack API requirements

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_14-slack-search-events.md`

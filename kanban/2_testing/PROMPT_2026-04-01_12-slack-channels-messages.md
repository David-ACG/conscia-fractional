# PROMPT 12: Slack Channel Mapping + Message Display on CRM Page

> **Phase 3 — Slack Integration (Prompt 12 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** with encrypted token storage: `id`, `user_id`, `provider`, `account_identifier`, `encrypted_token`, `metadata` (jsonb), `created_at`, `updated_at`
- **Existing `crm_customers` table** with customer records
- **Existing `contacts` table** with `email` field linked to crm_customers
- **CRM customer detail pages** at `/dashboard/crm/[slug]` with a tabbed layout
- **Slack OAuth** (from Prompt 11) stores `provider='slack'` in integrations with:
  - `encrypted_token`: encrypted bot token
  - `metadata.user_token_encrypted`: encrypted user token
  - `metadata.team_id`: Slack workspace ID
- **`@slack/web-api`** is installed
- **Encryption utilities** exist for decrypting stored tokens
- **Settings page** at `src/app/dashboard/settings/page.tsx` already has a Slack integration card

## Task

### 1. Create Supabase Migration for slack_channel_mappings

**File:** `supabase/migrations/<timestamp>_create_slack_channel_mappings.sql`

```sql
CREATE TABLE slack_channel_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  channel_id text NOT NULL,           -- Slack channel ID (e.g., C01ABC123)
  channel_name text NOT NULL,         -- Human-readable channel name
  crm_customer_id uuid NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(integration_id, channel_id)  -- One mapping per channel per integration
);

-- RLS: users can see/modify mappings for their own integrations
ALTER TABLE slack_channel_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own channel mappings"
  ON slack_channel_mappings
  FOR ALL
  USING (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  );
```

### 2. Create Slack Service

**File:** `src/lib/services/slack-service.ts`

```typescript
// Types:
// SlackChannel { id: string, name: string, is_private: boolean }
// SlackMessage { ts: string, user: string, user_name?: string, text: string, permalink?: string }

// Functions:

// listChannels(botToken: string) → Promise<SlackChannel[]>
//   - Use WebClient from @slack/web-api
//   - Call conversations.list with types: 'public_channel,private_channel'
//   - Paginate if needed (cursor-based)
//   - Return sorted by name

// getChannelMessages(botToken: string, channelId: string, limit = 20) → Promise<SlackMessage[]>
//   - Call conversations.history with limit
//   - Enrich with user names via users.info (cache user lookups)
//   - Return sorted by timestamp descending (newest first)

// searchMessages(userToken: string, query: string, channelId?: string) → Promise<SlackMessage[]>
//   - Call search.messages (requires user token, not bot token)
//   - If channelId provided, prepend "in:#channel-name" to query
//   - Return results with permalinks
```

### 3. Create API Routes

**File:** `src/app/api/integrations/slack/channels/route.ts`

```typescript
// GET ?integration_id=...
// 1. Verify authenticated user owns the integration
// 2. Decrypt bot token from integrations table
// 3. Call listChannels(botToken)
// 4. Return JSON array of SlackChannel
```

**File:** `src/app/api/integrations/slack/messages/route.ts`

```typescript
// GET ?channel_id=...&integration_id=...&limit=20
// 1. Verify user owns integration
// 2. Verify channel is mapped (via slack_channel_mappings)
// 3. Decrypt bot token
// 4. Call getChannelMessages(botToken, channelId, limit)
// 5. Return JSON array of SlackMessage
```

**File:** `src/app/api/integrations/slack/mapping/route.ts`

```typescript
// POST { integration_id, channel_id, channel_name, crm_customer_id }
// 1. Verify user owns integration
// 2. Insert into slack_channel_mappings
// 3. Return created mapping

// GET ?integration_id=...
// 1. Verify user owns integration
// 2. Return all mappings for this integration with crm_customer names joined
```

**File:** `src/app/api/integrations/slack/mapping/[id]/route.ts`

```typescript
// DELETE
// 1. Verify user owns the mapping's integration
// 2. Delete from slack_channel_mappings
// 3. Return 204
```

### 4. Create Channel Mapper Component

**File:** `src/components/settings/slack-channel-mapper.tsx`

- Renders under the Slack section on the Settings page (only when Slack is connected)
- Lists CRM customers in a table/list
- Each row has a dropdown to select a Slack channel (fetched from API)
- "Save" button per row or auto-save on selection
- Shows existing mappings with "Unlink" button
- Loading states while fetching channels
- Error handling if Slack API fails

### 5. Create Slack Messages Tab Component

**File:** `src/components/crm/slack-messages-tab.tsx`

- Tab content for the CRM customer detail page
- On mount: fetch messages from mapped channel via `/api/integrations/slack/messages`
- Display each message as a card/row:
  - Sender name (bold)
  - Timestamp (relative, e.g. "2 hours ago")
  - Message text (with basic Slack markdown rendering — bold, italic, links)
  - "Open in Slack" link using permalink
- Refresh button at the top
- Loading skeleton while fetching
- **Empty state when no channel mapped:**
  - "No Slack channel linked to this customer"
  - "Link a channel in Settings" button → `/dashboard/settings`
- **Empty state when channel mapped but no messages:**
  - "No recent messages in #channel-name"

### 6. Add Slack Tab to CRM Customer Detail Page

- Find the existing tabbed layout in the CRM detail page component
- Add a "Slack" tab with a message-square icon (Lucide `MessageSquare`)
- Tab renders `<SlackMessagesTab customerId={customer.id} />`
- Tab should show a badge or indicator if a channel is mapped

### 7. Write Vitest Tests

**File:** `src/lib/services/__tests__/slack-service.test.ts`

Test:

- `listChannels` calls conversations.list and returns formatted channels
- `getChannelMessages` returns messages with user names
- `searchMessages` formats query correctly with channel filter
- Pagination handling
- Error handling for expired tokens

**File:** `src/components/crm/__tests__/slack-messages-tab.test.tsx`

Test:

- Renders messages when channel is mapped
- Shows empty state when no channel mapped
- Shows empty state when no messages
- Refresh button triggers re-fetch
- "Open in Slack" links render correctly

## File Paths Summary

| Action | Path                                                                           |
| ------ | ------------------------------------------------------------------------------ |
| Create | `supabase/migrations/<timestamp>_create_slack_channel_mappings.sql`            |
| Create | `src/lib/services/slack-service.ts`                                            |
| Create | `src/app/api/integrations/slack/channels/route.ts`                             |
| Create | `src/app/api/integrations/slack/messages/route.ts`                             |
| Create | `src/app/api/integrations/slack/mapping/route.ts`                              |
| Create | `src/app/api/integrations/slack/mapping/[id]/route.ts`                         |
| Create | `src/components/settings/slack-channel-mapper.tsx`                             |
| Create | `src/components/crm/slack-messages-tab.tsx`                                    |
| Create | `src/lib/services/__tests__/slack-service.test.ts`                             |
| Create | `src/components/crm/__tests__/slack-messages-tab.test.tsx`                     |
| Modify | `src/app/dashboard/settings/page.tsx` (add channel mapper under Slack section) |
| Modify | CRM customer detail page component (add Slack tab)                             |

## Acceptance Criteria

- [ ] Migration creates `slack_channel_mappings` table with correct schema and RLS
- [ ] `listChannels` fetches channels from Slack API via bot token
- [ ] `getChannelMessages` fetches and enriches messages with user names
- [ ] Channel mapping CRUD works (create, read, delete)
- [ ] Channel mapper component on Settings page allows linking channels to customers
- [ ] Slack messages tab on CRM detail page displays messages from mapped channel
- [ ] "Open in Slack" permalink links work
- [ ] Empty states render correctly (no mapping, no messages)
- [ ] Refresh button works
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Migration includes proper RLS policies
- [ ] Both bot token and user token usage is correctly specified per API method

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_12-slack-channels-messages.md`

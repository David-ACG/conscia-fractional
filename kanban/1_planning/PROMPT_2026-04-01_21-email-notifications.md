# PROMPT 21: Email Polling + New Email Notifications

> **Phase 5 — Email/Gmail Integration (Prompt 21 of 24)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing `integrations` table** with encrypted token storage, `scopes` (text[]), `metadata` (jsonb), `is_active` flag
- **Gmail service** (from Prompt 18) at `src/lib/services/gmail-service.ts` with `listMessages`, `listMessagesForCustomer`, `getGmailClient`
- **`contacts` table** with `email` field linked to `crm_customers`
- **`googleapis`** npm package is installed
- **Encryption utilities** at `src/lib/encryption.ts`
- **Integration service** at `src/lib/services/integration-service.ts`
- **Existing cron pattern**: cron routes are secured with `CRON_SECRET` env var, checked via `Authorization: Bearer <CRON_SECRET>` header
- **Dashboard layout** at `src/app/(dashboard)/layout.tsx` with a header component
- **Existing migrations** in `supabase/migrations/` numbered sequentially

## Task

### 1. Create Notifications Table Migration

**File:** `supabase/migrations/<next_number>_create_notifications.sql`

Determine the next migration number by checking existing files in `supabase/migrations/`.

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,              -- 'new_email', 'new_slack_message', 'task_due', etc.
  title text NOT NULL,             -- e.g. "New email from john@example.com"
  body text,                       -- e.g. "Subject: Project Update"
  source_url text,                 -- link to open in Gmail/Slack/etc.
  crm_customer_id uuid REFERENCES crm_customers(id) ON DELETE SET NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- RLS: users see own notifications only
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Insert policy for service role only (cron jobs insert via admin client)
-- No INSERT policy for regular users — only admin client can create notifications
```

### 2. Create Email Sync Service

**File:** `src/lib/services/gmail-sync-service.ts`

```typescript
// checkNewEmails(integrationId: string) → Promise<NewEmailNotification[]>
//
// 1. Fetch integration record via admin client
// 2. Get last_checked_at from integration.metadata (default: 24 hours ago if first run)
// 3. Decrypt access token, refresh if needed
// 4. Get all CRM customers for this user
// 5. For each customer with contacts:
//    - Build query: "(from:a@x.com OR to:a@x.com) after:YYYY/MM/DD"
//    - Call listMessages with this query
//    - Filter out messages already seen (compare against metadata.last_seen_message_ids)
// 6. Return array of { subject, from, date, messageId, crmCustomerId, crmCustomerName }
// 7. Update integration.metadata:
//    - last_checked_at = now
//    - last_seen_message_ids = array of most recent 100 message IDs (ring buffer to prevent unbounded growth)

// Type:
// NewEmailNotification {
//   subject: string
//   from: string
//   date: string
//   messageId: string
//   crmCustomerId: string
//   crmCustomerName: string
// }
```

### 3. Create Gmail Sync Cron Route

**File:** `src/app/api/cron/gmail-sync/route.ts`

```typescript
// GET (or POST)
// 1. Verify CRON_SECRET: check Authorization header matches Bearer <process.env.CRON_SECRET>
//    - If missing or wrong, return 401
// 2. Fetch all active Google integrations that have gmail.metadata or gmail.readonly scope
//    - Use admin client (this runs as a system process, not a user request)
// 3. For each integration:
//    a. Call checkNewEmails(integrationId)
//    b. For each new email found:
//       - Insert a notification record via admin client:
//         {
//           user_id: integration.user_id,
//           type: 'new_email',
//           title: `New email from ${from}`,
//           body: `Subject: ${subject}`,
//           source_url: `https://mail.google.com/mail/u/0/#inbox/${messageId}`,
//           crm_customer_id: crmCustomerId,
//           is_read: false
//         }
// 4. Return summary: { integrations_checked: N, new_emails: N, notifications_created: N }
// 5. Handle errors per-integration (don't let one failed integration stop others)
//    - Log errors, continue to next integration
//    - Include error count in summary
```

### 4. Create Notification API Routes

**File:** `src/app/api/notifications/route.ts`

```typescript
// GET ?page=1&limit=20&unread_only=false
// 1. Get authenticated user
// 2. Query notifications table via admin client:
//    - Filter by user_id
//    - If unread_only=true: filter is_read = false
//    - Order by created_at DESC
//    - Paginate with offset/limit
// 3. Return: { notifications: Notification[], total: number, unread_count: number }
```

**File:** `src/app/api/notifications/[id]/route.ts`

```typescript
// PATCH body: { is_read: true }
// 1. Get authenticated user
// 2. Update notification by id WHERE user_id matches
// 3. Return updated notification
```

**File:** `src/app/api/notifications/read-all/route.ts`

```typescript
// PATCH (no body needed)
// 1. Get authenticated user
// 2. Update all notifications SET is_read = true WHERE user_id = ... AND is_read = false
// 3. Return: { updated_count: number }
```

### 5. Create Notification Bell Component

**File:** `src/components/layout/notification-bell.tsx`

- Uses Lucide `Bell` icon
- Fetches unread count on mount from `/api/notifications?unread_only=true&limit=1` (just need the `unread_count` from response)
- Polls every 60 seconds for updated count (using `setInterval` or SWR with `refreshInterval`)
- Badge: red circle with unread count (hidden if 0). Use shadcn `Badge` with destructive variant or custom CSS
- On click: opens a dropdown (shadcn `Popover` or `DropdownMenu`) showing recent notifications:
  - Fetch latest 10 notifications from `/api/notifications?limit=10`
  - Each item shows: icon based on type (Mail for email, MessageSquare for Slack), title, body (truncated), relative time
  - Unread items have a subtle background highlight
  - Click notification: mark as read via PATCH, navigate to source_url (or to CRM customer page if crm_customer_id exists)
  - "Mark all as read" button at the bottom
  - "View all notifications" link (optional, can link to a future notifications page)
- Empty state: "No notifications"

### 6. Add Notification Bell to Dashboard Header

**Modify:** The existing header/navbar component in the dashboard layout

- Find the header component (likely in `src/components/layout/` or within `src/app/(dashboard)/layout.tsx`)
- Add `<NotificationBell />` to the right side of the header, before the user avatar/menu

### 7. Add CRON_SECRET to .env.local.example

Add:

```
# Cron job authentication
CRON_SECRET=
```

### 8. Write Vitest Tests

**File:** `src/lib/services/__tests__/gmail-sync-service.test.ts`

Test:

- `checkNewEmails` queries Gmail with correct after: date filter
- New emails detected (not in last_seen_message_ids)
- Already-seen emails filtered out
- last_seen_message_ids capped at 100 (ring buffer)
- Token refresh triggered when needed
- Handles integration with no contacts gracefully

**File:** `src/app/api/cron/__tests__/gmail-sync.test.ts`

Test:

- Returns 401 when CRON_SECRET missing or wrong
- Creates notifications for new emails
- Handles multiple integrations
- Continues processing when one integration fails
- Returns correct summary counts

**File:** `src/components/layout/__tests__/notification-bell.test.tsx`

Test:

- Renders bell icon
- Shows badge with unread count
- Badge hidden when count is 0
- Dropdown shows notification list
- Click notification calls mark-as-read API
- "Mark all as read" button works

## File Paths Summary

| Action | Path                                                         |
| ------ | ------------------------------------------------------------ |
| Create | `supabase/migrations/<next>_create_notifications.sql`        |
| Create | `src/lib/services/gmail-sync-service.ts`                     |
| Create | `src/app/api/cron/gmail-sync/route.ts`                       |
| Create | `src/app/api/notifications/route.ts`                         |
| Create | `src/app/api/notifications/[id]/route.ts`                    |
| Create | `src/app/api/notifications/read-all/route.ts`                |
| Create | `src/components/layout/notification-bell.tsx`                |
| Create | `src/lib/services/__tests__/gmail-sync-service.test.ts`      |
| Create | `src/app/api/cron/__tests__/gmail-sync.test.ts`              |
| Create | `src/components/layout/__tests__/notification-bell.test.tsx` |
| Modify | Dashboard header component (add notification bell)           |
| Modify | `.env.local.example` (add CRON_SECRET)                       |

## Acceptance Criteria

- [ ] `notifications` table created with RLS (users see only their own)
- [ ] Email polling detects new messages since last check
- [ ] Seen message IDs tracked to avoid duplicate notifications
- [ ] Cron route secured with CRON_SECRET
- [ ] Notifications created for each new email with correct metadata
- [ ] Notification bell renders in dashboard header
- [ ] Unread count badge visible and updates
- [ ] Click notification marks as read and navigates to source
- [ ] "Mark all as read" works
- [ ] Per-integration error handling (one failure doesn't block others)
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Notifications table is generic (supports future Slack notifications too)
- [ ] Cron security pattern matches existing project conventions
- [ ] Ring buffer for seen message IDs prevents unbounded metadata growth

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_21-email-notifications.md`

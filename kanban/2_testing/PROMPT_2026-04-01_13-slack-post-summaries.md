# PROMPT 13: Post Meeting Summaries + Task Updates to Slack

> **Phase 3 — Slack Integration (Prompt 13 of 17)**
> **Project:** FractionalBuddy (conscia-fractional)
> **Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase, Tailwind CSS v4, shadcn/ui, Radix, Lucide icons
> **Testing:** Vitest + Playwright
> **Site URL:** http://localhost:3002

## Context

FractionalBuddy is a CRM + meeting management tool for fractional executives. It has:

- **Supabase** for auth and PostgreSQL DB with RLS
- **All server actions use `createAdminClient`** (bypasses RLS) — this is a project convention
- **Existing tables:**
  - `integrations` — encrypted token storage (`provider`, `account_identifier`, `encrypted_token`, `metadata` jsonb)
  - `crm_customers` — customer records
  - `meetings` — with `transcript`, `summary`, `crm_customer_id` fields
  - `tasks` — task records with `crm_customer_id`
  - `slack_channel_mappings` — (from Prompt 12) maps Slack channels to CRM customers: `integration_id`, `channel_id`, `channel_name`, `crm_customer_id`
- **Existing Slack service** at `src/lib/services/slack-service.ts` (from Prompt 12) with `listChannels`, `getChannelMessages`, `searchMessages`
- **Slack OAuth** stores `provider='slack'` in integrations with encrypted bot token and user token
- **`@slack/web-api`** is installed — use `WebClient` for API calls
- **Meeting processing endpoint** at `/api/meetings/process-transcript` — processes uploaded transcripts, extracts summary, decisions, action items
- **Encryption utilities** exist for decrypting stored tokens

## Task

### 1. Add Posting Methods to Slack Service

**File:** `src/lib/services/slack-service.ts` (modify existing)

Add these functions:

```typescript
// postMessage(botToken: string, channelId: string, text: string, blocks?: KnownBlock[]) → Promise<void>
//   - Use WebClient.chat.postMessage
//   - text is the fallback for notifications
//   - blocks is the rich Block Kit layout
//   - Handle errors: channel_not_found, not_in_channel, token_revoked

// formatMeetingSummary(meeting: { title, date, participants, decisions, action_items }) → { text, blocks }
//   - Header block: meeting title + formatted date
//   - Section block: "Participants" — bulleted list of names
//   - Section block: "Key Decisions" — bulleted list (or "None recorded" if empty)
//   - Section block: "Action Items" — bulleted list with assignee in bold (or "None" if empty)
//   - Context block: "Posted by FractionalBuddy" with timestamp
//   - text fallback: "Meeting summary: {title} — {date}"
//
// Use Slack Block Kit format:
// {
//   type: 'section',
//   text: { type: 'mrkdwn', text: '...' }
// }

// formatTaskUpdate(task: { title, assignee?, status? }, action: 'created'|'updated'|'completed') → { text, blocks }
//   - Emoji prefix: created = ":clipboard:", updated = ":pencil2:", completed = ":white_check_mark:"
//   - Section: "{emoji} Task {action}: *{title}*"
//   - If assignee: "Assigned to: {assignee}"
//   - Context: "FractionalBuddy"
//   - text fallback: "Task {action}: {title}"
```

### 2. Create Notification Service

**File:** `src/lib/services/slack-notification-service.ts`

```typescript
// notifyMeetingProcessed(meetingId: string) → Promise<void>
//   1. Fetch meeting record (with summary, decisions, action_items, crm_customer_id)
//   2. If no crm_customer_id → return (can't find channel)
//   3. Find Slack integration for the meeting's user (provider='slack')
//   4. If no Slack integration → return
//   5. Find channel mapping for crm_customer_id + integration_id
//   6. If no mapping → return
//   7. Decrypt bot token
//   8. Format meeting summary
//   9. Post to channel
//   10. Check notification toggle (metadata.notify_meeting_summaries !== false)
//   11. ALL errors caught and logged — never throw

// notifyTaskCreated(taskId: string) → Promise<void>
//   1. Fetch task record (with title, crm_customer_id, assignee)
//   2. Same lookup chain: customer → integration → channel mapping
//   3. Check toggle: metadata.notify_task_updates !== false
//   4. Format task update with action='created'
//   5. Post to channel
//   6. ALL errors caught and logged

// notifyTaskCompleted(taskId: string) → Promise<void>
//   1. Same as above but action='completed'
```

**Key design decisions:**

- All methods are **fire-and-forget** — they never throw
- Each method does its own lookup chain (meeting → customer → integration → channel)
- If any step in the chain is missing, silently return
- Log errors with `console.error` for debugging

### 3. Integrate into Meeting Processing

**File:** Modify the existing meeting processing endpoint (likely `src/app/api/meetings/process-transcript/route.ts` or equivalent)

After the transcript is processed and meeting record is saved:

```typescript
// Non-blocking notification — don't await if you don't need to
// But do await to ensure it completes before the response (Edge runtime consideration)
try {
  await notifyMeetingProcessed(meeting.id);
} catch (error) {
  console.error("Slack notification failed:", error);
  // Don't re-throw — meeting processing succeeded
}
```

Similarly, integrate into task creation flow:

- Find where tasks are created (from meeting extraction or manual creation)
- After task is saved, call `notifyTaskCreated(task.id)`
- Same non-blocking pattern

And task completion:

- Find where tasks are marked complete
- Call `notifyTaskCompleted(task.id)`

### 4. Add Notification Toggles to Settings

Modify the Slack section of the Settings page:

- When Slack is connected, show two toggles below the connection info:
  - "Post meeting summaries to Slack" — default ON
  - "Post task updates to Slack" — default ON
- Toggles save to `integrations.metadata`:
  - `metadata.notify_meeting_summaries: boolean` (default true if missing)
  - `metadata.notify_task_updates: boolean` (default true if missing)
- Use shadcn Switch component
- Create an API route or server action to update integration metadata:
  - `PATCH /api/integrations/[id]/metadata` or use existing update mechanism

### 5. Write Vitest Tests

**File:** `src/lib/services/__tests__/slack-notification-service.test.ts`

Test:

- `notifyMeetingProcessed` posts formatted summary to correct channel
- `notifyMeetingProcessed` silently returns when no Slack integration
- `notifyMeetingProcessed` silently returns when no channel mapping
- `notifyMeetingProcessed` silently returns when notifications disabled
- `notifyTaskCreated` posts task creation message
- `notifyTaskCompleted` posts task completion message
- All methods catch errors and don't throw
- `formatMeetingSummary` produces valid Block Kit structure
- `formatTaskUpdate` produces correct emoji and text for each action type

## File Paths Summary

| Action | Path                                                                                          |
| ------ | --------------------------------------------------------------------------------------------- |
| Modify | `src/lib/services/slack-service.ts` (add postMessage, formatMeetingSummary, formatTaskUpdate) |
| Create | `src/lib/services/slack-notification-service.ts`                                              |
| Modify | Meeting processing endpoint (add notifyMeetingProcessed call)                                 |
| Modify | Task creation logic (add notifyTaskCreated call)                                              |
| Modify | Task completion logic (add notifyTaskCompleted call)                                          |
| Modify | `src/app/dashboard/settings/page.tsx` (add notification toggles)                              |
| Create | `src/lib/services/__tests__/slack-notification-service.test.ts`                               |

## Acceptance Criteria

- [ ] Meeting summaries post to the correct mapped Slack channel after processing
- [ ] Task creation and completion messages post to the correct mapped Slack channel
- [ ] Block Kit formatting renders nicely in Slack (header, bullets, context)
- [ ] Notifications are non-blocking — errors are logged but never thrown to the caller
- [ ] Silently skips when: no Slack integration, no channel mapping, or notifications disabled
- [ ] Notification toggles on Settings page save to integrations.metadata
- [ ] Toggles default to ON when metadata field is missing
- [ ] All Vitest tests pass (`npm test`)

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Non-blocking error handling is clearly specified
- [ ] Block Kit message format is detailed enough to implement

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_13-slack-post-summaries.md`

---

## Implementation Notes — 2026-04-01 22:57

- **Commit:** (uncommitted — tests passing, ready to commit)
- **Tests:** 482 passed / 0 failed (50 test files)
- **Verification URL:** http://localhost:3002/dashboard/settings
- **Playwright check:** Not run — no visual-only changes; logic is server-side
- **Changes summary:**
  - `src/lib/services/slack-service.ts` — added `postMessage`, `formatMeetingSummary`, `formatTaskUpdate`
  - `src/lib/services/slack-notification-service.ts` — new file: `notifyMeetingProcessed`, `notifyTaskCreated`, `notifyTaskCompleted`
  - `src/lib/actions/meetings.ts` — calls `notifyMeetingProcessed` after `createMeetingFromTranscript`
  - `src/lib/actions/tasks.ts` — `createTask` returns task ID and fires `notifyTaskCreated`; `updateTaskStatus` fires `notifyTaskCompleted` when status='done'
  - `src/app/api/integrations/[id]/metadata/route.ts` — new PATCH endpoint, merges metadata patch for authenticated owner
  - `src/components/settings/slack-notification-toggles.tsx` — new Switch component for meeting/task notification toggles
  - `src/app/(dashboard)/settings/page.tsx` — renders `SlackNotificationToggles` when Slack is connected
  - `src/lib/actions/__tests__/tasks.test.ts` — updated mock to support `.select().single()` chain + added notification mock
  - `src/lib/services/__tests__/slack-notification-service.test.ts` — 19 new tests
- **Deviations from plan:**
  - Notification service queries integrations without user_id filter (single-user app; no user_id on meetings/tasks tables)
  - `notifyTaskCreated` is fire-and-forget (`.catch()`) to avoid blocking server action response; `notifyMeetingProcessed` is awaited in a try/catch
- **Follow-up issues:** None

---

## Testing Checklist — 2026-04-01 22:57

**Check the changes:** http://localhost:3002/dashboard/settings

- [ ] Settings page loads without errors when Slack is connected
- [ ] Two toggles appear below channel mapper: "Post meeting summaries" and "Post task updates"
- [ ] Toggling saves to integrations.metadata (check Supabase table or Network tab)
- [ ] After uploading a transcript with a crm_customer_id mapped to a Slack channel, message posts to Slack
- [ ] After creating a task for a mapped customer, message posts to Slack
- [ ] After marking a task done, completion message posts to Slack
- [ ] Disabling "Post meeting summaries" prevents meeting posts
- [ ] Disabling "Post task updates" prevents task posts
- [ ] No console errors on settings page

### Actions for David

1. Connect Slack and map at least one channel to a CRM customer
2. Upload a meeting transcript for that customer and verify summary posts to Slack
3. Create a task for the mapped customer and verify creation message posts
4. Mark that task as "done" and verify completion message posts
5. Toggle off "Post meeting summaries", process another transcript, confirm no Slack post
6. Check the Settings page URL above and tick the checklist boxes

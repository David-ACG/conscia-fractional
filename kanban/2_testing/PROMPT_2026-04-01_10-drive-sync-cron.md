# PROMPT 10: Drive Sync Polling Cron + Change Detection

**Date:** 2026-04-01
**Plan Reference:** PLAN_2026-04-01_integrations-meeting-recording.md (Phase 2: Google Drive)

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application for fractional executives. It uses Supabase for auth and DB (PostgreSQL with RLS), Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons for UI. All server actions use `createAdminClient` (synchronous, bypasses RLS). Site runs at http://localhost:3002.

This prompt creates the background sync mechanism that keeps the local `drive_files` cache up-to-date with Google Drive. It polls all linked folders on a schedule, detects new/changed/removed files, and updates the cache.

**DEPENDS ON:**

- Prompt 01: `integrations` table, encryption
- Prompt 07: Google OAuth service (`getValidAccessToken`, token refresh)
- Prompt 08: `crm_drive_folders` + `drive_files` tables, `google-drive-service.ts` (`listFiles`)
- Prompt 09: Drive file browser UI (this prompt adds sync status display to it)

**Existing tables (from Prompt 08):**

- `crm_drive_folders`: id, crm_customer_id, integration_id, folder_id, folder_name, created_at
- `drive_files`: id, crm_drive_folder_id, google_file_id, name, mime_type, size_bytes, modified_at, web_view_link, thumbnail_link, last_synced_at

## Task

### 1. Create sync service at `src/lib/services/drive-sync-service.ts`

```typescript
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { listFiles } from "./google-drive-service";
```

**Types:**

```typescript
export interface SyncResult {
  crmDriveFolderId: string;
  folderName: string;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}
```

**Functions:**

- **`syncFolder(crmDriveFolderId: string)`** — Syncs a single linked folder. Returns `SyncResult`.

  Algorithm:
  1. Fetch the `crm_drive_folders` record (including `integration_id` and `folder_id`) using admin client
  2. Fetch ALL current files from Google Drive (handle pagination — loop until no `nextPageToken`)
     - Call `listFiles(integrationId, folderId, pageToken)` in a loop
     - Collect all files into a single array
  3. Fetch ALL cached files from `drive_files` table for this `crm_drive_folder_id`
  4. Compare:
     - **New files:** Google files not in cache (by `google_file_id`) → INSERT
     - **Updated files:** Google files where `modifiedTime` differs from cached `modified_at` → UPDATE name, mime_type, size_bytes, modified_at, web_view_link, thumbnail_link, last_synced_at
     - **Removed files:** Cached files whose `google_file_id` is not in the Google response → DELETE
  5. Update `last_synced_at` on the `crm_drive_folders` record (add this column if not present — see migration below)
  6. Return `SyncResult` with counts
  7. Error handling: if Google API fails (auth error, quota), catch and include in `errors` array. Do not abort the entire sync — log and continue.

- **`syncAllFolders()`** — Syncs all active linked folders. Returns `SyncResult[]`.
  1. Fetch all `crm_drive_folders` records (admin client)
  2. Group by `integration_id` to batch requests per Google account
  3. Process sequentially per integration (not parallel — respect API quota)
  4. Add 1-second delay between folders to stay under Google Drive API rate limit (1000 queries per 100 seconds per user)
  5. Return array of `SyncResult`

- **`syncFolderById(id: string)`** — Public wrapper that validates the folder exists and calls `syncFolder`. Used by the manual "Sync now" button.

### 2. Create Supabase migration for last_synced_at on crm_drive_folders

Create `supabase/migrations/008_drive_folders_last_synced.sql`:

```sql
-- Add last_synced_at to crm_drive_folders for tracking sync status
ALTER TABLE crm_drive_folders ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;
```

**Note:** Check if `last_synced_at` was already included in the `007_drive_tables.sql` migration from Prompt 08. If it was, this migration is not needed — skip creating it. The plan schema in the PLAN file does include it, but the Prompt 08 schema might not. The implementer should check and only create this migration if the column is missing.

### 3. Create cron API route at `src/app/api/cron/drive-sync/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { syncAllFolders } from "@/lib/services/drive-sync-service";
```

**GET handler:**

1. Validate authorization: check `Authorization` header equals `Bearer ${process.env.CRON_SECRET}`
   - If missing or wrong → return 401 `{ error: "Unauthorized" }`
2. Call `syncAllFolders()`
3. Return JSON summary:
   ```json
   {
     "success": true,
     "synced": 5,
     "results": [
       { "crmDriveFolderId": "...", "folderName": "LoveSac Shared", "added": 2, "updated": 1, "removed": 0, "errors": [] },
       ...
     ],
     "totalAdded": 3,
     "totalUpdated": 1,
     "totalRemoved": 0,
     "totalErrors": 0,
     "durationMs": 4521
   }
   ```
4. If an unexpected error occurs, return 500 with error message

**Security:** This route must NOT require Supabase auth (it's called by a cron service, not a user). Authentication is via the CRON_SECRET bearer token only.

**Rate limiting consideration:** Google Drive API has a quota of 12,000 queries per day and 1,000 queries per 100 seconds per user. Each folder sync uses ~1-3 queries (list files, possibly pagination). With 15-minute intervals and ~10 folders, that's ~40-120 queries/hour — well within limits.

### 4. Add cron configuration

Add to `.env.local.example`:

```
# Cron
CRON_SECRET=
```

Create or update `vercel.json` in project root (if deploying to Vercel):

```json
{
  "crons": [
    {
      "path": "/api/cron/drive-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

If `vercel.json` already exists, add the crons key to it. If not deploying to Vercel, this serves as documentation.

**Local development:** Add a comment in the route file explaining how to trigger manually:

```
// Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/drive-sync
```

### 5. Create manual sync API route at `src/app/api/integrations/google/drive/sync/route.ts`

**POST handler** (for the "Sync now" button in the UI):

- Body: `{ crm_drive_folder_id: string }`
- Requires Supabase auth (user must own the integration linked to this folder)
- Calls `syncFolderById(crmDriveFolderId)`
- Returns `SyncResult` as JSON

This is separate from the cron route because it requires user auth and syncs a single folder.

### 6. Update Drive file browser UI (from Prompt 09)

Modify `src/components/crm/drive-files-tab.tsx`:

**Sync status display:**

- Below the folder selector, show: "Last synced: {relative time}" using the `last_synced_at` field from the `crm_drive_folders` record
- If never synced: "Not synced yet"
- If synced more than 30 minutes ago: show in amber/warning color

**"Sync now" button:**

- Button with `RefreshCw` Lucide icon next to the sync status
- On click: calls `POST /api/integrations/google/drive/sync` with the selected folder ID
- While syncing: button shows spinner, disabled
- On success: show toast with sync results ("2 files added, 1 updated")
- Refresh the file list after sync completes
- On error: show error toast

**Sync result toast format:**

- "Synced: 2 new, 1 updated, 0 removed" (if changes detected)
- "Already up to date" (if no changes)
- "Sync failed: {error message}" (on error)

### 7. Write Vitest tests

Create `src/lib/services/__tests__/drive-sync-service.test.ts`:

- Mock `google-drive-service` `listFiles` function
- Mock Supabase admin client

Tests:

- **syncFolder — new files:** Given Google returns files not in cache → inserts them, returns correct `added` count
- **syncFolder — updated files:** Given Google returns files with different `modifiedTime` → updates them, returns correct `updated` count
- **syncFolder — removed files:** Given cache has files not in Google response → deletes them, returns correct `removed` count
- **syncFolder — mixed changes:** Combination of new, updated, and removed files in one sync
- **syncFolder — no changes:** Google response matches cache exactly → returns all zeros
- **syncFolder — pagination:** Google returns multiple pages → fetches all pages before comparing
- **syncFolder — API error:** Google API call fails → catches error, returns it in `errors` array
- **syncAllFolders — processes all folders:** Given 3 linked folders → syncs each, returns 3 results
- **syncAllFolders — groups by integration:** Folders with same integration processed together

Create `src/app/api/cron/drive-sync/__tests__/route.test.ts`:

- Test valid CRON_SECRET returns sync results
- Test missing Authorization header returns 401
- Test wrong CRON_SECRET returns 401
- Test handles syncAllFolders error gracefully (500)

Create `src/app/api/integrations/google/drive/sync/__tests__/route.test.ts`:

- Test authenticated user can trigger sync
- Test unauthenticated request returns 401
- Test user cannot sync folder they don't own
- Test returns sync results on success

## Files to Create

- `src/lib/services/drive-sync-service.ts`
- `src/app/api/cron/drive-sync/route.ts`
- `src/app/api/integrations/google/drive/sync/route.ts`
- `supabase/migrations/008_drive_folders_last_synced.sql` (only if `last_synced_at` not in 007)
- `vercel.json` (or update if exists)
- `src/lib/services/__tests__/drive-sync-service.test.ts`
- `src/app/api/cron/drive-sync/__tests__/route.test.ts`
- `src/app/api/integrations/google/drive/sync/__tests__/route.test.ts`

## Files to Modify

- `src/components/crm/drive-files-tab.tsx` — add sync status display and "Sync now" button
- `.env.local.example` — add CRON_SECRET

## Files to Reference (read patterns from)

- `src/lib/services/google-drive-service.ts` — `listFiles` function (from Prompt 08)
- `src/lib/services/google-auth-service.ts` — `getValidAccessToken` (from Prompt 07)
- `src/lib/supabase/admin.ts` — createAdminClient (synchronous)
- `src/components/crm/drive-files-tab.tsx` — UI to modify (from Prompt 09)
- Existing API routes for auth patterns

## Acceptance Criteria

- [ ] Sync service detects new files and inserts them into cache
- [ ] Sync service detects updated files (changed modifiedTime) and updates cache
- [ ] Sync service detects removed files and deletes them from cache
- [ ] Sync handles pagination (folders with 50+ files)
- [ ] Cron route is secured with CRON_SECRET bearer token
- [ ] Cron route returns detailed sync summary
- [ ] Unauthenticated cron requests return 401
- [ ] Rate limiting: 1-second delay between folders respects Google API quota
- [ ] Manual "Sync now" button works from the Drive file browser
- [ ] Sync status ("Last synced: X minutes ago") displays correctly
- [ ] Toast notifications show sync results
- [ ] Sync errors are caught and reported (not silent failures)
- [ ] vercel.json cron configuration is correct (_/15 _ \* \* \*)
- [ ] All new tests pass
- [ ] All existing tests pass (`npm test`)

## Notes

- The 15-minute cron interval is a good starting point. Can be adjusted later based on usage patterns and API quota consumption.
- Google Drive API quota: 12,000 requests/day, 1,000 requests/100s per user. With 10 folders syncing every 15 minutes, that's ~960 requests/day (well under limit).
- The cron route is designed to work with Vercel Cron, but the CRON_SECRET pattern also works with any external cron service (e.g., cron-job.org, Hetzner cron).
- For future enhancement: Google Drive Changes API (`changes.watch`) could replace polling for real-time notifications, but polling is simpler and sufficient for this use case.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Sync algorithm (new/updated/removed) is clearly specified
- [ ] Rate limiting and API quota considerations are documented

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_10-drive-sync-cron.md`

---

## Implementation Notes — 2026-04-01 22:12

- **Commit:** (uncommitted — pending review)
- **Tests:** 429 passed (46 test files) — all green, including 13 new tests for this prompt
- **Verification URL:** http://localhost:3002 (Drive file browser at any CRM customer with a linked folder)
- **Playwright check:** N/A — no web server running in this session
- **Changes summary:**
  - `src/lib/services/drive-sync-service.ts` — sync service with `syncFolder`, `syncAllFolders`, `syncFolderById`
  - `src/app/api/cron/drive-sync/route.ts` — cron endpoint secured by CRON_SECRET bearer token
  - `src/app/api/integrations/google/drive/sync/route.ts` — user-authenticated manual sync endpoint
  - `supabase/migrations/010_drive_folders_last_synced.sql` — adds `last_synced_at` to `crm_drive_folders`
  - `vercel.json` — cron schedule at _/15 _ \* \* \*
  - `.env.local.example` — added CRON_SECRET variable
  - `src/components/crm/drive-files-tab.tsx` — sync status display (amber if >30 min), Sync now button with sonner toast
  - 3 new test files covering all sync scenarios (new/updated/removed/pagination/errors/auth)
- **Deviations from plan:** None. Migration numbered 010 (009 was already taken by drive_tables).
- **Follow-up issues:** Need to set CRON_SECRET in production environment. Run `supabase db push` to apply migration 010.

---

## Testing Checklist — 2026-04-01 22:12

**Check the changes:** http://localhost:3002/dashboard/crm (open any customer → Drive tab)

- [ ] Page loads without errors
- [ ] Sync status shows "Not synced yet" for folders not yet synced
- [ ] Sync now button triggers sync and shows toast ("2 new, 1 updated" or "Already up to date")
- [ ] After sync, "Last synced X minutes ago" appears
- [ ] If sync was >30 mins ago, status shows in amber
- [ ] Cron endpoint reachable: `curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/drive-sync`
- [ ] Cron endpoint returns 401 without correct secret
- [ ] No console errors

### Actions for David

1. Add `CRON_SECRET=<random-string>` to your `.env.local` file
2. Run `supabase db push` (or apply migration 010 manually) to add `last_synced_at` to `crm_drive_folders`
3. Open any CRM customer with a linked Drive folder and click the sync button to verify the toast
4. Set `CRON_SECRET` in your Vercel/Coolify environment variables for production cron to work

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_10-drive-sync-cron.md`

# PROMPT 08: Drive File Listing API + CRM Folder Linking

**Date:** 2026-04-01
**Plan Reference:** PLAN_2026-04-01_integrations-meeting-recording.md (Phase 2: Google Drive)

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application for fractional executives. It uses Supabase for auth and DB (PostgreSQL with RLS), Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons for UI. All server actions use `createAdminClient` (synchronous, bypasses RLS). Site runs at http://localhost:3002.

This prompt creates the backend for browsing Google Drive files and linking Drive folders to CRM customers. It builds on the Google OAuth flow from Prompt 07.

**DEPENDS ON:**

- Prompt 01: `integrations` table, encryption utilities at `src/lib/encryption.ts`
- Prompt 07: Google OAuth service at `src/lib/services/google-auth-service.ts` with `getValidAccessToken(integrationId)`, `createOAuth2Client()`, token refresh logic

**Existing CRM structure:**

- CRM customers table: `crm_customers` with columns including `id` (uuid PK), `client_id`, `name`, `slug`
- CRM customer detail page at `src/app/(dashboard)/crm/[slug]/page.tsx`
- CRM components in `src/components/crm/`

## Task

### 1. Create Supabase migration

Create migration file `supabase/migrations/007_drive_tables.sql`:

```sql
-- Link CRM customers to Google Drive folders
CREATE TABLE crm_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_customer_id uuid NOT NULL REFERENCES crm_customers(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  folder_id text NOT NULL,           -- Google Drive folder ID
  folder_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(crm_customer_id, integration_id, folder_id) -- prevent duplicate links
);

-- Row Level Security
ALTER TABLE crm_drive_folders ENABLE ROW LEVEL SECURITY;

-- Users see folders linked via their own integrations
CREATE POLICY "Users see own integration folders" ON crm_drive_folders
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM integrations WHERE user_id = auth.uid()
    )
  );

-- Cache file metadata locally
CREATE TABLE drive_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crm_drive_folder_id uuid NOT NULL REFERENCES crm_drive_folders(id) ON DELETE CASCADE,
  google_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  modified_at timestamptz,
  web_view_link text,
  thumbnail_link text,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(crm_drive_folder_id, google_file_id) -- prevent duplicate file entries per folder
);

-- Row Level Security
ALTER TABLE drive_files ENABLE ROW LEVEL SECURITY;

-- Users see files in folders linked via their own integrations
CREATE POLICY "Users see own integration files" ON drive_files
  FOR ALL USING (
    crm_drive_folder_id IN (
      SELECT cdf.id FROM crm_drive_folders cdf
      JOIN integrations i ON i.id = cdf.integration_id
      WHERE i.user_id = auth.uid()
    )
  );
```

**Migration numbering:** Check existing migrations in `supabase/migrations/` — the latest is `006_crm_google_drive_url.sql`. Use `007` as the next number.

### 2. Create Drive service at `src/lib/services/google-drive-service.ts`

```typescript
import { google, drive_v3 } from "googleapis";
import { getValidAccessToken, createOAuth2Client } from "./google-auth-service";
```

Implement the following:

**Types:**

```typescript
export interface DriveFile {
  id: string; // Google Drive file ID
  name: string;
  mimeType: string;
  size: number | null; // in bytes
  modifiedTime: string; // ISO date
  webViewLink: string;
  thumbnailLink: string | null;
  iconLink: string | null;
}

export interface DriveFolder {
  id: string;
  name: string;
  modifiedTime: string;
}
```

**Functions:**

- **`getAuthenticatedDriveClient(integrationId: string)`** — Returns an authenticated `drive_v3.Drive` instance
  - Calls `getValidAccessToken(integrationId)` to get a valid token
  - Creates OAuth2 client, sets credentials
  - Returns `google.drive({ version: 'v3', auth: oauth2Client })`

- **`listFiles(integrationId: string, folderId: string, pageToken?: string)`** — Lists files in a Drive folder
  - Query: `'${folderId}' in parents AND trashed = false AND mimeType != 'application/vnd.google-apps.folder'`
  - Fields: `nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, iconLink)`
  - Order by: `modifiedTime desc`
  - Page size: 50
  - Returns `{ files: DriveFile[], nextPageToken: string | null }`

- **`listFolders(integrationId: string, parentId?: string)`** — Lists folders for the folder picker
  - If no parentId, use `'root'` to list top-level folders
  - Query: `'${parentId}' in parents AND trashed = false AND mimeType = 'application/vnd.google-apps.folder'`
  - Fields: `files(id, name, modifiedTime)`
  - Order by: `name asc`
  - Returns `DriveFolder[]`

- **`getFileMetadata(integrationId: string, fileId: string)`** — Gets metadata for a single file
  - Fields: `id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, iconLink`
  - Returns `DriveFile`

- **`getFolderMetadata(integrationId: string, folderId: string)`** — Gets folder name/info
  - Used for breadcrumb navigation in folder picker
  - Returns `{ id: string, name: string, parents: string[] }`

Error handling for all functions:

- If 401 (token expired mid-request): token refresh is handled by `getValidAccessToken`, but if it still fails, throw `GoogleAuthError`
- If 404 (file/folder not found): throw `GoogleDriveNotFoundError`
- If 403 (no permission): throw `GoogleDrivePermissionError`
- Wrap Google API errors in custom error classes for clean handling upstream

### 3. Create API routes

All API routes require authentication. Pattern:

```typescript
import { createClient } from "@/lib/supabase/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
// Use server createClient for auth check, admin for data operations
```

**`GET /api/integrations/google/drive/files`** at `src/app/api/integrations/google/drive/files/route.ts`:

- Query params: `folder_id` (required), `integration_id` (required), `crm_drive_folder_id` (required), `page_token` (optional)
- Validates user is authenticated and owns the integration
- Calls `listFiles(integrationId, folderId, pageToken)`
- Caches results: upserts each file into `drive_files` table (using admin client)
  - Upsert on `(crm_drive_folder_id, google_file_id)` unique constraint
  - Updates name, mime_type, size_bytes, modified_at, web_view_link, thumbnail_link, last_synced_at
- Returns JSON: `{ files: DriveFile[], nextPageToken: string | null }`

**`GET /api/integrations/google/drive/folders`** at `src/app/api/integrations/google/drive/folders/route.ts`:

- Query params: `integration_id` (required), `parent_id` (optional, defaults to root)
- Validates user owns the integration
- Calls `listFolders(integrationId, parentId)`
- Also calls `getFolderMetadata(integrationId, parentId)` to get current folder name for breadcrumbs (skip if parentId is 'root' or missing)
- Returns JSON: `{ folders: DriveFolder[], currentFolder: { id, name } | null }`

**`POST /api/integrations/google/drive/link`** at `src/app/api/integrations/google/drive/link/route.ts`:

- Body: `{ crm_customer_id: string, integration_id: string, folder_id: string, folder_name: string }`
- Validates user owns the integration
- Validates crm_customer_id belongs to user's active client
- Inserts into `crm_drive_folders` table (admin client)
- Returns the created record as JSON

**`DELETE /api/integrations/google/drive/link/[id]`** at `src/app/api/integrations/google/drive/link/[id]/route.ts`:

- Path param: `id` (crm_drive_folders record ID)
- Validates user owns the integration linked to this folder record
- Deletes the `crm_drive_folders` record (cascades to delete cached `drive_files`)
- Returns `{ success: true }`

### 4. Write Vitest tests

Create `src/lib/services/__tests__/google-drive-service.test.ts`:

- Mock `googleapis` module
- Test `listFiles` returns correctly formatted files
- Test `listFiles` handles pagination (pageToken)
- Test `listFolders` returns folders sorted by name
- Test `listFolders` uses 'root' as default parent
- Test `getFileMetadata` returns single file
- Test error handling: 401 → GoogleAuthError, 404 → GoogleDriveNotFoundError, 403 → GoogleDrivePermissionError

Create `src/app/api/integrations/google/drive/__tests__/routes.test.ts`:

- Test `/files` route caches results to database
- Test `/folders` route returns folder list
- Test `/link` POST creates crm_drive_folders record
- Test `/link/[id]` DELETE removes record
- Test all routes reject unauthenticated requests
- Test routes validate integration ownership

## Files to Create

- `supabase/migrations/007_drive_tables.sql`
- `src/lib/services/google-drive-service.ts`
- `src/app/api/integrations/google/drive/files/route.ts`
- `src/app/api/integrations/google/drive/folders/route.ts`
- `src/app/api/integrations/google/drive/link/route.ts`
- `src/app/api/integrations/google/drive/link/[id]/route.ts`
- `src/lib/services/__tests__/google-drive-service.test.ts`
- `src/app/api/integrations/google/drive/__tests__/routes.test.ts`

## Files to Reference (read patterns from)

- `src/lib/supabase/admin.ts` — createAdminClient (synchronous, no await)
- `src/lib/supabase/server.ts` — createClient for auth context
- `src/lib/services/google-auth-service.ts` — from Prompt 07
- `supabase/migrations/006_crm_google_drive_url.sql` — migration numbering
- Existing API routes for authentication patterns

## Acceptance Criteria

- [ ] Migration `007_drive_tables.sql` creates `crm_drive_folders` and `drive_files` tables with RLS policies
- [ ] Drive service lists files and folders from Google Drive API
- [ ] API routes work with authentication and validate integration ownership
- [ ] File metadata is cached locally in `drive_files` table on each fetch
- [ ] CRM customer can be linked to a Google Drive folder via POST `/link`
- [ ] Multiple folders per customer supported (different folders, same or different Google accounts)
- [ ] Multiple Google accounts handled correctly
- [ ] DELETE `/link/[id]` removes folder link and cascades to cached files
- [ ] Custom error classes for auth, not-found, and permission errors
- [ ] All new tests pass
- [ ] All existing tests pass (`npm test`)

## Notes

- The `drive_files` table is a cache — the source of truth is Google Drive. Files are refreshed on each list request and updated by the sync cron (Prompt 10).
- Page size of 50 balances responsiveness with API quota usage.
- The `UNIQUE` constraints prevent duplicate entries when re-linking or re-syncing.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Migration numbering is correct (007 after 006)
- [ ] RLS policies reference the integrations table correctly

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_08-drive-file-listing.md`

---

## Implementation Notes — 2026-04-01 21:48

- **Commit:** pending
- **Tests:** 41 files passed, 373 tests total — all new tests pass, no regressions
- **Verification URL:** N/A (backend-only, no UI)
- **Playwright check:** N/A (no UI changes)
- **Changes summary:**
  - `supabase/migrations/009_drive_tables.sql` — Creates `crm_drive_folders` and `drive_files` tables with RLS policies (migration numbered 009, not 007 — existing migrations 007 and 008 already existed)
  - `src/lib/services/google-auth-service.ts` — Exported `createOAuth2Client` (was private)
  - `src/lib/services/google-drive-service.ts` — Drive service with `listFiles`, `listFolders`, `getFileMetadata`, `getFolderMetadata`, `getAuthenticatedDriveClient`; custom error classes `GoogleAuthError`, `GoogleDriveNotFoundError`, `GoogleDrivePermissionError`
  - `src/app/api/integrations/google/drive/files/route.ts` — GET handler, validates auth + integration ownership, caches results to `drive_files`
  - `src/app/api/integrations/google/drive/folders/route.ts` — GET handler, returns folders + currentFolder metadata for breadcrumbs
  - `src/app/api/integrations/google/drive/link/route.ts` — POST handler, creates `crm_drive_folders` record with 409 on duplicate
  - `src/app/api/integrations/google/drive/link/[id]/route.ts` — DELETE handler, validates ownership then cascades via DB
  - `src/lib/services/__tests__/google-drive-service.test.ts` — 15 tests covering list, pagination, metadata, all 3 error types
  - `src/app/api/integrations/google/drive/__tests__/routes.test.ts` — 13 tests covering all 4 routes, auth, ownership, caching, 409 duplicate
- **Deviations from plan:** Migration numbered 009 (not 007) — 007_integrations.sql and 008_meeting_recordings_bucket.sql existed already
- **Follow-up issues:** None — ready for frontend folder picker UI (Prompt 09)

---

## Testing Checklist — 2026-04-01 21:48

**Check the changes:** N/A (backend only)

- [x] All 373 tests pass
- [ ] Migration 009_drive_tables.sql applied to local Supabase
- [ ] GET /api/integrations/google/drive/files returns files for a linked folder
- [ ] GET /api/integrations/google/drive/folders returns folder list for root
- [ ] POST /api/integrations/google/drive/link creates a folder link
- [ ] DELETE /api/integrations/google/drive/link/[id] removes folder link

### Actions for David

1. Apply the migration: `supabase db push` or run `supabase migration up` against your local instance
2. Verify the two new tables appear in Supabase Studio: `crm_drive_folders` and `drive_files`
3. The API routes are ready to be consumed by the folder picker UI (Prompt 09)

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_08-drive-file-listing.md`

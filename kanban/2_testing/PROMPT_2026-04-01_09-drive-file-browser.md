# PROMPT 09: Drive File Browser Component on CRM Detail Page

**Date:** 2026-04-01
**Plan Reference:** PLAN_2026-04-01_integrations-meeting-recording.md (Phase 2: Google Drive)

## Context

FractionalBuddy is a Next.js 16 App Router + React 19 + TypeScript application for fractional executives. It uses Supabase for auth and DB (PostgreSQL with RLS), Tailwind CSS v4 + shadcn/ui + Radix + Lucide icons for UI. All server actions use `createAdminClient` (synchronous, bypasses RLS). Site runs at http://localhost:3002.

This prompt creates the frontend UI for browsing Google Drive files on the CRM customer detail page. Users can link Drive folders to customers and browse files inline.

**DEPENDS ON:**

- Prompt 01: `integrations` table, settings page
- Prompt 07: Google OAuth service, connected Google accounts
- Prompt 08: Drive file listing API routes, `crm_drive_folders` + `drive_files` tables, `google-drive-service.ts`

**Existing CRM detail page structure:**

- Page: `src/app/(dashboard)/crm/[slug]/page.tsx` — Server component that fetches customer data and renders tabs
- Tabs component: `src/components/crm/customer-tabs.tsx` — Uses shadcn/ui `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`
- Current tabs: Meetings, Tasks, Timesheet, Assets, Deliverables

**API routes available (from Prompt 08):**

- `GET /api/integrations/google/drive/files?folder_id=...&integration_id=...&crm_drive_folder_id=...`
- `GET /api/integrations/google/drive/folders?integration_id=...&parent_id=...`
- `POST /api/integrations/google/drive/link` — body: `{ crm_customer_id, integration_id, folder_id, folder_name }`
- `DELETE /api/integrations/google/drive/link/[id]`

## Task

### 1. Create Drive file browser component at `src/components/crm/drive-files-tab.tsx`

Client component (`"use client"`) that serves as the content for the Drive tab.

**Props:**

```typescript
interface DriveFilesTabProps {
  crmCustomerId: string;
  crmCustomerName: string;
}
```

**State management:** Use React `useState` and `useEffect` for:

- `linkedFolders` — array of crm_drive_folders records (fetched on mount)
- `selectedFolderId` — which linked folder is currently displayed
- `files` — array of files for the selected folder
- `isLoading` — loading state
- `nextPageToken` — for pagination ("Load more" button)

**On mount:** Fetch linked folders for this customer:

```typescript
// Server action or fetch call to get linked folders
const supabase = createAdminClient();
const { data } = await supabase
  .from("crm_drive_folders")
  .select("*, integrations(account_identifier)")
  .eq("crm_customer_id", crmCustomerId);
```

Create a server action at `src/lib/actions/drive.ts` for this:

- `getLinkedFolders(crmCustomerId: string)` — returns folders with integration email
- `unlinkFolder(folderId: string)` — deletes the link

**Layout:**

**When no folders linked:**

```
┌─────────────────────────────────────────────────┐
│  No Google Drive folders linked                  │
│                                                   │
│  Link a folder from Google Drive to see files    │
│  for {customerName} here.                        │
│                                                   │
│  [Link Google Drive Folder]                      │
│                                                   │
│  (If no Google accounts connected:)              │
│  Connect a Google account first in Settings.     │
│  [Go to Settings]                                │
└─────────────────────────────────────────────────┘
```

**When folders linked:**

```
┌─────────────────────────────────────────────────┐
│  [LoveSac Shared ▾] [david@gwth.ai]  [+ Link]  │
│  Last synced: 5 min ago  [↻ Refresh]            │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ 📄 solution-design.docx   2.4 MB  Mar 28   │ │
│  │ 📊 requirements.xlsx      1.1 MB  Mar 25   │ │
│  │ 📄 architecture-v2.pdf    5.8 MB  Mar 20   │ │
│  │ 🖼️ wireframes.png         890 KB  Mar 18   │ │
│  │ ...                                         │ │
│  └─────────────────────────────────────────────┘ │
│                                                   │
│  [Load More]  (if nextPageToken exists)          │
└─────────────────────────────────────────────────┘
```

**Folder selector:** If multiple folders linked, show a dropdown (`Select` from shadcn/ui) to switch between them. Show the Google account email next to each folder name.

**File list table columns:**
| Column | Content |
|--------|---------|
| Name | File type icon (from Lucide) + file name |
| Size | Human-readable (KB, MB, GB) |
| Modified | Relative date ("3 days ago") or formatted date |
| Actions | "Open in Drive" button (ExternalLink icon) → `web_view_link` in new tab |

**File type icons** (map MIME type to Lucide icon):

- `application/pdf` → `FileText`
- `application/vnd.google-apps.document` → `FileText`
- `application/vnd.google-apps.spreadsheet` → `FileSpreadsheet`
- `application/vnd.google-apps.presentation` → `Presentation` (or `FileText`)
- `image/*` → `FileImage`
- `video/*` → `FileVideo`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → `FileText`
- `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` → `FileSpreadsheet`
- Default → `File`

**Sort:** Default sort by modified date (newest first). Add clickable column headers for Name and Modified to toggle sort direction (client-side sort on loaded data).

**Refresh button:** Calls the files API again and updates the list. Shows a spinner while loading.

**"Link Google Drive Folder" button:** Opens the folder picker dialog (see below).

**Unlink folder:** Each linked folder in the dropdown has an "Unlink" option (with confirmation). Calls `DELETE /api/integrations/google/drive/link/[id]`.

### 2. Create folder picker component at `src/components/crm/drive-folder-picker.tsx`

Client component using shadcn/ui `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`.

**Props:**

```typescript
interface DriveFolderPickerProps {
  crmCustomerId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFolderLinked: () => void; // callback to refresh parent
}
```

**Layout:**

```
┌─────────────────────────────────────────────────┐
│  Link Google Drive Folder                    [X] │
│                                                   │
│  Account: [david@gwth.ai ▾]                     │
│                                                   │
│  My Drive > Clients > Conscia                    │
│                                                   │
│  📁 LoveSac Shared                               │
│  📁 Holt Renfrew                                 │
│  📁 Meeting Notes                                │
│  📁 Proposals                                    │
│                                                   │
│  [Cancel]              [Select "Conscia"]        │
└─────────────────────────────────────────────────┘
```

**Behavior:**

1. On open, fetch connected Google accounts from integrations table (server action in `src/lib/actions/integrations.ts` — add `getGoogleIntegrations()`)
2. If multiple accounts, show account selector dropdown
3. Start at root folder — call `GET /api/integrations/google/drive/folders?integration_id=...`
4. Display folders as a list — click a folder to navigate into it (fetch subfolders)
5. **Breadcrumb navigation** at the top: "My Drive > Folder > Subfolder"
   - Track navigation path as an array of `{ id, name }` objects
   - Click any breadcrumb segment to navigate back to that level
   - "My Drive" is always the root
6. **"Select this folder" button** shows the current folder name: `Select "Conscia"`
   - Clicking it calls `POST /api/integrations/google/drive/link` with the current folder
   - On success, close dialog and call `onFolderLinked()` callback
7. Loading state: show skeleton loaders while folders are fetching
8. Empty state: "This folder has no subfolders" — user can still select the current folder
9. Error state: "Could not load folders. Check your Google connection." with retry button

**Account selector:** If no Google accounts connected, show a message with link to Settings page instead of the folder list.

### 3. Add "Drive" tab to CRM customer detail page

Modify `src/components/crm/customer-tabs.tsx`:

- Add a new tab after Deliverables (or at end): label "Drive" with `HardDrive` Lucide icon
- Tab content renders `<DriveFilesTab crmCustomerId={customer.id} crmCustomerName={customer.name} />`
- Import the new component

Modify `src/app/(dashboard)/crm/[slug]/page.tsx` if needed:

- Pass `customer.id` and `customer.name` to the tabs component (check if already available)

### 4. Add server actions

Add to `src/lib/actions/integrations.ts` (created in Prompt 07) or create `src/lib/actions/drive.ts`:

```typescript
"use server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";

// Get linked folders for a CRM customer (with integration email)
export async function getLinkedFolders(crmCustomerId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("crm_drive_folders")
    .select("*, integrations(account_identifier)")
    .eq("crm_customer_id", crmCustomerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Get all Google integrations for the current user
export async function getGoogleIntegrations() {
  // ... fetch from integrations where provider = 'google'
}
```

### 5. Write Vitest tests

Create `src/components/crm/__tests__/drive-files-tab.test.tsx`:

- Test renders empty state when no folders linked
- Test renders "Go to Settings" when no Google accounts connected
- Test renders file list when folder is linked
- Test file type icons map correctly
- Test human-readable file sizes (bytes → KB/MB/GB)
- Test sort toggle works
- Test "Load more" button appears when nextPageToken exists

Create `src/components/crm/__tests__/drive-folder-picker.test.tsx`:

- Test renders account selector
- Test breadcrumb navigation
- Test folder click navigates into subfolder
- Test "Select this folder" calls link API
- Test empty folder state

## Files to Create

- `src/components/crm/drive-files-tab.tsx`
- `src/components/crm/drive-folder-picker.tsx`
- `src/lib/actions/drive.ts`
- `src/components/crm/__tests__/drive-files-tab.test.tsx`
- `src/components/crm/__tests__/drive-folder-picker.test.tsx`

## Files to Modify

- `src/components/crm/customer-tabs.tsx` — add Drive tab
- `src/app/(dashboard)/crm/[slug]/page.tsx` — ensure customer.id and customer.name are passed to tabs
- `src/lib/actions/integrations.ts` — add `getGoogleIntegrations()` (if not already added by Prompt 07)

## Files to Reference (read patterns from)

- `src/components/crm/customer-tabs.tsx` — existing tab structure and shadcn/ui Tabs usage
- `src/app/(dashboard)/crm/[slug]/page.tsx` — data fetching pattern, props passed to components
- `src/components/crm/customer-detail-header.tsx` — component pattern
- Any existing shadcn/ui Dialog usage in the project for modal patterns
- `src/lib/supabase/admin.ts` — createAdminClient (synchronous)

## Acceptance Criteria

- [ ] "Drive" tab appears on CRM customer detail page alongside existing tabs
- [ ] Empty state shown when no folders linked with "Link Google Drive Folder" button
- [ ] "Go to Settings" shown when no Google accounts connected
- [ ] Folder picker dialog opens, shows Google accounts, allows folder browsing
- [ ] Breadcrumb navigation works in folder picker
- [ ] Selecting a folder links it to the CRM customer
- [ ] File list displays with correct icons, human-readable sizes, and relative dates
- [ ] "Open in Drive" opens the file's web_view_link in a new tab
- [ ] Sort by name and modified date works
- [ ] "Load more" pagination works
- [ ] Refresh button re-fetches files
- [ ] Multiple linked folders can be switched via dropdown
- [ ] Unlink folder with confirmation removes the link
- [ ] Loading and error states handled gracefully
- [ ] All new tests pass
- [ ] All existing tests pass (`npm test`)

## Notes

- The file list comes from the API routes built in Prompt 08, which cache results in the `drive_files` table.
- File type icon mapping should be in a utility function for reuse.
- Use `formatDistanceToNow` from date-fns (already a dependency via shadcn/ui) for relative dates.
- The Drive tab should feel consistent with the other tabs (Meetings, Tasks, etc.) in terms of spacing and table style.

---

## Review Checklist — 2026-04-01 16:00

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Existing tab structure is referenced correctly
- [ ] Component props and data flow are clearly specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-01_09-drive-file-browser.md`

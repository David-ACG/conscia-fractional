import { createAdminClient } from "@/lib/supabase/admin";
import { listFiles } from "./google-drive-service";
import { embedDriveFile } from "./auto-embed-service";

export interface SyncResult {
  crmDriveFolderId: string;
  folderName: string;
  added: number;
  updated: number;
  removed: number;
  errors: string[];
}

export async function syncFolder(
  crmDriveFolderId: string,
): Promise<SyncResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      crmDriveFolderId,
      folderName: "",
      added: 0,
      updated: 0,
      removed: 0,
      errors: ["Database unavailable"],
    };
  }

  // 1. Fetch the crm_drive_folders record
  const { data: folderRecord, error: folderError } = await admin
    .from("crm_drive_folders")
    .select("id, integration_id, folder_id, folder_name, crm_customer_id")
    .eq("id", crmDriveFolderId)
    .single();

  if (folderError || !folderRecord) {
    return {
      crmDriveFolderId,
      folderName: "",
      added: 0,
      updated: 0,
      removed: 0,
      errors: [
        `Folder record not found: ${folderError?.message ?? "unknown error"}`,
      ],
    };
  }

  const result: SyncResult = {
    crmDriveFolderId,
    folderName: folderRecord.folder_name,
    added: 0,
    updated: 0,
    removed: 0,
    errors: [],
  };

  // 2. Fetch ALL files from Google Drive (paginate)
  let allGoogleFiles: Array<{
    id: string;
    name: string;
    mimeType: string;
    size: number | null;
    modifiedTime: string;
    webViewLink: string;
    thumbnailLink: string | null;
  }> = [];

  try {
    let pageToken: string | undefined = undefined;
    do {
      const page = await listFiles(
        folderRecord.integration_id,
        folderRecord.folder_id,
        pageToken,
      );
      allGoogleFiles = allGoogleFiles.concat(page.files);
      pageToken = page.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Google Drive API error: ${message}`);
    return result;
  }

  // 3. Fetch cached files from drive_files
  const { data: cachedFiles, error: cacheError } = await admin
    .from("drive_files")
    .select("id, google_file_id, modified_at")
    .eq("crm_drive_folder_id", crmDriveFolderId);

  if (cacheError) {
    result.errors.push(`Cache fetch error: ${cacheError.message}`);
    return result;
  }

  const cached = cachedFiles ?? [];

  // Build lookup maps
  const googleMap = new Map(allGoogleFiles.map((f) => [f.id, f]));
  const cacheMap = new Map(cached.map((f) => [f.google_file_id, f]));

  // 4. Compute changes
  const toInsert: Array<{
    crm_drive_folder_id: string;
    google_file_id: string;
    name: string;
    mime_type: string | null;
    size_bytes: number | null;
    modified_at: string | null;
    web_view_link: string | null;
    thumbnail_link: string | null;
    last_synced_at: string;
  }> = [];

  const toUpdate: Array<{
    id: string;
    name: string;
    mime_type: string | null;
    size_bytes: number | null;
    modified_at: string | null;
    web_view_link: string | null;
    thumbnail_link: string | null;
    last_synced_at: string;
  }> = [];

  const now = new Date().toISOString();

  for (const gFile of allGoogleFiles) {
    const cached = cacheMap.get(gFile.id);
    if (!cached) {
      // New file
      toInsert.push({
        crm_drive_folder_id: crmDriveFolderId,
        google_file_id: gFile.id,
        name: gFile.name,
        mime_type: gFile.mimeType ?? null,
        size_bytes: gFile.size ?? null,
        modified_at: gFile.modifiedTime || null,
        web_view_link: gFile.webViewLink ?? null,
        thumbnail_link: gFile.thumbnailLink ?? null,
        last_synced_at: now,
      });
    } else {
      // Check if updated (compare modifiedTime)
      const cachedModified = cached.modified_at
        ? new Date(cached.modified_at).toISOString()
        : null;
      const googleModified = gFile.modifiedTime
        ? new Date(gFile.modifiedTime).toISOString()
        : null;

      if (cachedModified !== googleModified) {
        toUpdate.push({
          id: cached.id,
          name: gFile.name,
          mime_type: gFile.mimeType ?? null,
          size_bytes: gFile.size ?? null,
          modified_at: gFile.modifiedTime || null,
          web_view_link: gFile.webViewLink ?? null,
          thumbnail_link: gFile.thumbnailLink ?? null,
          last_synced_at: now,
        });
      }
    }
  }

  // Files in cache but not in Google response → removed
  const toDeleteIds: string[] = [];
  for (const c of cached) {
    if (!googleMap.has(c.google_file_id)) {
      toDeleteIds.push(c.id);
    }
  }

  // 5. Execute DB operations
  if (toInsert.length > 0) {
    const { error } = await admin.from("drive_files").insert(toInsert);
    if (error) {
      result.errors.push(`Insert error: ${error.message}`);
    } else {
      result.added = toInsert.length;

      // Fire-and-forget: queue new files for embedding
      const { data: integration } = await admin
        .from("integrations")
        .select("user_id")
        .eq("id", folderRecord.integration_id)
        .single();

      if (integration?.user_id) {
        for (const file of toInsert) {
          embedDriveFile(
            file.google_file_id,
            integration.user_id as string,
            folderRecord.integration_id,
            folderRecord.crm_customer_id as string | undefined,
          ).catch((err) => {
            console.error(
              `[drive-sync] Failed to queue embedding for ${file.google_file_id}:`,
              err,
            );
          });
        }
      }
    }
  }

  for (const row of toUpdate) {
    const { id, ...updates } = row;
    const { error } = await admin
      .from("drive_files")
      .update(updates)
      .eq("id", id);
    if (error) {
      result.errors.push(`Update error for ${id}: ${error.message}`);
    } else {
      result.updated++;
    }
  }

  if (toDeleteIds.length > 0) {
    const { error } = await admin
      .from("drive_files")
      .delete()
      .in("id", toDeleteIds);
    if (error) {
      result.errors.push(`Delete error: ${error.message}`);
    } else {
      result.removed = toDeleteIds.length;
    }
  }

  // 6. Update last_synced_at on the folder record
  await admin
    .from("crm_drive_folders")
    .update({ last_synced_at: now })
    .eq("id", crmDriveFolderId);

  return result;
}

export async function syncAllFolders(): Promise<SyncResult[]> {
  const admin = createAdminClient();
  if (!admin) {
    return [];
  }

  const { data: folders, error } = await admin
    .from("crm_drive_folders")
    .select("id, integration_id");

  if (error || !folders) return [];

  // Group by integration_id for sequential processing per account
  const byIntegration = new Map<string, string[]>();
  for (const f of folders) {
    const existing = byIntegration.get(f.integration_id) ?? [];
    existing.push(f.id);
    byIntegration.set(f.integration_id, existing);
  }

  const results: SyncResult[] = [];

  for (const folderIds of byIntegration.values()) {
    for (let i = 0; i < folderIds.length; i++) {
      if (i > 0) {
        // 1-second delay between folders to respect Google API rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      const result = await syncFolder(folderIds[i]);
      results.push(result);
    }
  }

  return results;
}

/** Public wrapper for the manual "Sync now" button — validates folder exists first */
export async function syncFolderById(id: string): Promise<SyncResult> {
  const admin = createAdminClient();
  if (!admin) {
    return {
      crmDriveFolderId: id,
      folderName: "",
      added: 0,
      updated: 0,
      removed: 0,
      errors: ["Database unavailable"],
    };
  }

  const { data: folder } = await admin
    .from("crm_drive_folders")
    .select("id")
    .eq("id", id)
    .single();

  if (!folder) {
    return {
      crmDriveFolderId: id,
      folderName: "",
      added: 0,
      updated: 0,
      removed: 0,
      errors: ["Folder not found"],
    };
  }

  return syncFolder(id);
}

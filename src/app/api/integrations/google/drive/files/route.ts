import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listFiles } from "@/lib/services/google-drive-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder_id");
  const integrationId = searchParams.get("integration_id");
  const crmDriveFolderId = searchParams.get("crm_drive_folder_id");
  const pageToken = searchParams.get("page_token") ?? undefined;

  if (!folderId || !integrationId || !crmDriveFolderId) {
    return NextResponse.json(
      {
        error:
          "Missing required params: folder_id, integration_id, crm_drive_folder_id",
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Validate integration ownership
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: integration } = await admin
    .from("integrations")
    .select("id")
    .eq("id", integrationId)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  try {
    const result = await listFiles(integrationId, folderId, pageToken);

    // Cache results in drive_files table
    if (result.files.length > 0) {
      const upsertRows = result.files.map((f) => ({
        crm_drive_folder_id: crmDriveFolderId,
        google_file_id: f.id,
        name: f.name,
        mime_type: f.mimeType,
        size_bytes: f.size,
        modified_at: f.modifiedTime || null,
        web_view_link: f.webViewLink,
        thumbnail_link: f.thumbnailLink,
        last_synced_at: new Date().toISOString(),
      }));

      await admin.from("drive_files").upsert(upsertRows, {
        onConflict: "crm_drive_folder_id,google_file_id",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to list files";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

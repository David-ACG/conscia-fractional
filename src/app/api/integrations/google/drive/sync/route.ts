import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncFolderById } from "@/lib/services/drive-sync-service";

export async function POST(request: NextRequest) {
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

  let body: { crm_drive_folder_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { crm_drive_folder_id } = body;
  if (!crm_drive_folder_id) {
    return NextResponse.json(
      { error: "Missing crm_drive_folder_id" },
      { status: 400 },
    );
  }

  // Verify the folder belongs to an integration owned by this user
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: folder } = await admin
    .from("crm_drive_folders")
    .select("id, integration_id")
    .eq("id", crm_drive_folder_id)
    .single();

  if (!folder) {
    return NextResponse.json({ error: "Folder not found" }, { status: 404 });
  }

  const { data: integration } = await admin
    .from("integrations")
    .select("id")
    .eq("id", folder.integration_id)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const result = await syncFolderById(crm_drive_folder_id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

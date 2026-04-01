import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  // Fetch the folder record and verify the user owns the linked integration
  const { data: folderRecord } = await admin
    .from("crm_drive_folders")
    .select("id, integration_id")
    .eq("id", id)
    .single();

  if (!folderRecord) {
    return NextResponse.json(
      { error: "Folder link not found" },
      { status: 404 },
    );
  }

  // Validate the integration belongs to the authenticated user
  const { data: integration } = await admin
    .from("integrations")
    .select("id")
    .eq("id", folderRecord.integration_id)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { error } = await admin.from("crm_drive_folders").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

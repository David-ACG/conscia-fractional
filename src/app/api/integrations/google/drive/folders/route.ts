import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  listFolders,
  getFolderMetadata,
} from "@/lib/services/google-drive-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integration_id");
  const parentId = searchParams.get("parent_id") ?? undefined;

  if (!integrationId) {
    return NextResponse.json(
      { error: "Missing required param: integration_id" },
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
    const folders = await listFolders(integrationId, parentId);

    // Get current folder metadata for breadcrumbs (skip for root)
    let currentFolder: { id: string; name: string } | null = null;
    if (parentId && parentId !== "root") {
      const meta = await getFolderMetadata(integrationId, parentId);
      currentFolder = { id: meta.id, name: meta.name };
    }

    return NextResponse.json({ folders, currentFolder });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list folders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

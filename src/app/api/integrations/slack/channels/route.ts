import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { listChannels } from "@/lib/services/slack-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integration_id");

  if (!integrationId) {
    return NextResponse.json(
      { error: "Missing integration_id" },
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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: integration } = await admin
    .from("integrations")
    .select("id, access_token_encrypted")
    .eq("id", integrationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  if (!integration.access_token_encrypted) {
    return NextResponse.json(
      { error: "No bot token available" },
      { status: 400 },
    );
  }

  try {
    const botToken = decrypt(integration.access_token_encrypted);
    const channels = await listChannels(botToken);
    return NextResponse.json(channels);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

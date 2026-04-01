import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { integration_id, channel_id, channel_name, crm_customer_id } =
    body as {
      integration_id?: string;
      channel_id?: string;
      channel_name?: string;
      crm_customer_id?: string;
    };

  if (!integration_id || !channel_id || !channel_name || !crm_customer_id) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: integration_id, channel_id, channel_name, crm_customer_id",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  // Verify user owns the integration
  const { data: integration } = await admin
    .from("integrations")
    .select("id")
    .eq("id", integration_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  const { data: mapping, error } = await admin
    .from("slack_channel_mappings")
    .insert({ integration_id, channel_id, channel_name, crm_customer_id })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Channel already mapped" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(mapping, { status: 201 });
}

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

  // Verify user owns the integration
  const { data: integration } = await admin
    .from("integrations")
    .select("id")
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

  const { data: mappings, error } = await admin
    .from("slack_channel_mappings")
    .select("*, crm_customers(id, name)")
    .eq("integration_id", integrationId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(mappings ?? []);
}

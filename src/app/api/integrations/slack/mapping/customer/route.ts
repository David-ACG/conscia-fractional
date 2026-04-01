import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET ?customer_id=...
// Returns the first slack_channel_mapping for this customer across the user's Slack integrations
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");

  if (!customerId) {
    return NextResponse.json({ error: "Missing customer_id" }, { status: 400 });
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

  // Get user's Slack integration IDs
  const { data: slackIntegrations } = await admin
    .from("integrations")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "slack")
    .eq("is_active", true);

  if (!slackIntegrations || slackIntegrations.length === 0) {
    return NextResponse.json(null);
  }

  const integrationIds = slackIntegrations.map((i: { id: string }) => i.id);

  const { data: mapping } = await admin
    .from("slack_channel_mappings")
    .select("id, channel_id, channel_name, crm_customer_id, integration_id")
    .eq("crm_customer_id", customerId)
    .in("integration_id", integrationIds)
    .limit(1)
    .maybeSingle();

  return NextResponse.json(mapping ?? null);
}

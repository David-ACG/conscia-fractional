import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Verify authenticated user
  const serverClient = await createClient();
  if (!serverClient) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
  } = await serverClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: event, error } = await adminClient
    .from("calendar_events")
    .select(
      "id, title, description, start_time, end_time, location, meeting_url, attendees, crm_customer_id, meeting_id, status, google_event_id, crm_customer:crm_customers(id, name, slug)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(event);
}

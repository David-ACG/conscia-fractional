import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json([], { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json([], { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const limitParam = searchParams.get("limit");
  const includeLimit = limitParam ? parseInt(limitParam, 10) : null;

  let query = supabase
    .from("calendar_events")
    .select(
      `
      id,
      title,
      start_time,
      end_time,
      location,
      meeting_url,
      attendees,
      crm_customer_id,
      meeting_id,
      status,
      google_event_id,
      crm_customers (
        id,
        name,
        slug
      )
    `,
    )
    .eq("user_id", user.id)
    .neq("status", "cancelled")
    .order("start_time", { ascending: true });

  if (start) {
    query = query.gte("start_time", start);
  }
  if (end) {
    query = query.lte("end_time", end);
  }
  if (includeLimit) {
    query = query.limit(includeLimit);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const events = (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    start: row.start_time,
    end: row.end_time,
    location: row.location ?? null,
    meeting_url: row.meeting_url ?? null,
    attendees:
      (row.attendees as Array<{
        email: string;
        name?: string;
        responseStatus?: string;
      }>) ?? [],
    crm_customer: row.crm_customers
      ? {
          id: (row.crm_customers as { id: string; name: string; slug: string })
            .id,
          name: (
            row.crm_customers as { id: string; name: string; slug: string }
          ).name,
          slug: (
            row.crm_customers as { id: string; name: string; slug: string }
          ).slug,
        }
      : null,
    meeting_id: row.meeting_id ?? null,
    status: row.status,
    google_event_id: row.google_event_id ?? null,
  }));

  return NextResponse.json(events);
}

import { NextResponse } from "next/server";
import { createAdminClient as createClient } from "@/lib/supabase/admin";

// GET — return current active timer + today's total
export async function GET() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ activeTimer: null, todayTotalMinutes: 0 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ activeTimer: null, todayTotalMinutes: 0 });
  }

  // Get active timer
  const { data: activeTimer } = await supabase
    .from("active_timer")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  // Get today's total minutes
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: entries } = await supabase
    .from("time_entries")
    .select("duration_minutes")
    .gte("started_at", todayStart.toISOString());

  const todayTotalMinutes =
    entries?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) ?? 0;

  return NextResponse.json({ activeTimer, todayTotalMinutes });
}

// POST — start timer
export async function POST(request: Request) {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { category, client_id } = body;

  // Delete any existing active timer first
  await supabase.from("active_timer").delete().eq("user_id", user.id);

  // Insert new active timer
  const { data, error } = await supabase
    .from("active_timer")
    .insert({
      user_id: user.id,
      category: category || null,
      client_id: client_id || null,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ activeTimer: data });
}

// PATCH — stop timer, create time entry
export async function PATCH() {
  const supabase = createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get active timer
  const { data: timer } = await supabase
    .from("active_timer")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!timer) {
    return NextResponse.json({ error: "No active timer" }, { status: 404 });
  }

  const stoppedAt = new Date();
  const startedAt = new Date(timer.started_at);
  const durationMinutes = Math.round(
    (stoppedAt.getTime() - startedAt.getTime()) / 60000,
  );

  // Create time entry
  const { error: entryError } = await supabase.from("time_entries").insert({
    client_id: timer.client_id,
    category: timer.category || "General",
    started_at: timer.started_at,
    stopped_at: stoppedAt.toISOString(),
    duration_minutes: Math.max(1, durationMinutes),
    is_manual: false,
    is_billable: true,
    is_client_visible: false,
  });

  if (entryError) {
    return NextResponse.json({ error: entryError.message }, { status: 500 });
  }

  // Delete active timer
  await supabase.from("active_timer").delete().eq("user_id", user.id);

  // Return updated today total
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: entries } = await supabase
    .from("time_entries")
    .select("duration_minutes")
    .gte("started_at", todayStart.toISOString());

  const todayTotalMinutes =
    entries?.reduce((sum, e) => sum + (e.duration_minutes || 0), 0) ?? 0;

  return NextResponse.json({ stopped: true, todayTotalMinutes });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!clientId || !from || !to) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data, error } = await supabase
    .from("time_entries")
    .select("*")
    .eq("client_id", clientId)
    .gte("started_at", from)
    .lte("started_at", to)
    .order("started_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("time_entries").insert(body);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { id, ...updates } = await request.json();
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("time_entries")
    .update(updates)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

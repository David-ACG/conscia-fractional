import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: meeting, error } = await supabase
    .from("meetings")
    .select("title, transcript, meeting_date")
    .eq("id", id)
    .single();

  if (error || !meeting) {
    return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  }

  if (!meeting.transcript) {
    return NextResponse.json(
      { error: "No transcript available" },
      { status: 404 },
    );
  }

  // Build a filename from the meeting title and date
  const date = meeting.meeting_date
    ? new Date(meeting.meeting_date).toISOString().split("T")[0]
    : "unknown-date";
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const filename = `${date}_${slug}.txt`;

  return new NextResponse(meeting.transcript, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

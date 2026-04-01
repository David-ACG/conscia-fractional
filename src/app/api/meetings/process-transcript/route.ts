import { NextRequest, NextResponse } from "next/server";
import { extractMeetingData } from "@/lib/services/transcript-extraction-service";

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured. Add it to .env.local" },
      { status: 500 },
    );
  }

  let body: { transcript: string; filename?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!body.transcript || typeof body.transcript !== "string") {
    return NextResponse.json(
      { error: "transcript field is required" },
      { status: 400 },
    );
  }

  try {
    const result = await extractMeetingData(body.transcript, body.filename);
    return NextResponse.json({
      title: result.title,
      summary: result.summary,
      tasks: result.tasks,
      metadata: result.metadata,
      rawTranscript: body.transcript,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

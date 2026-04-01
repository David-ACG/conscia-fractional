import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeBatch } from "@/lib/services/transcription-service";
import type { TranscriptionConfig } from "@/lib/types/transcription";

export async function POST(request: Request) {
  if (!process.env.DEEPGRAM_API_KEY) {
    return NextResponse.json(
      { error: "Deepgram API key not configured" },
      { status: 500 },
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

  let body: { audioUrl?: string; config?: TranscriptionConfig };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.audioUrl) {
    return NextResponse.json(
      { error: "audioUrl is required" },
      { status: 400 },
    );
  }

  try {
    const segments = await transcribeBatch(body.audioUrl, body.config);

    const speakerSet = new Set(segments.map((s) => s.speaker));
    const lastSegment = segments[segments.length - 1];
    const durationMs = lastSegment ? lastSegment.endMs : 0;

    return NextResponse.json({
      segments,
      speakers: Array.from(speakerSet),
      durationMs,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

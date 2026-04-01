import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTemporaryApiKey } from "@/lib/services/transcription-service";

export async function POST() {
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

  try {
    const { key, expiresAt } = await createTemporaryApiKey();
    return NextResponse.json({ key, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create temporary key";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

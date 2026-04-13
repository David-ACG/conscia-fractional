import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Returns a signed upload URL so the client can upload directly to Supabase
 * Storage, bypassing both the Next.js body size limit and the Supabase API
 * gateway's 50 MB proxy limit.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as {
    path?: string;
    contentType?: string;
  };
  const { path, contentType } = body;

  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  if (!path.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data, error } = await admin.storage
    .from("meeting-recordings")
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create upload URL: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: data.token,
    path: data.path,
    signedUrl: data.signedUrl,
    contentType: contentType || "audio/mpeg",
  });
}

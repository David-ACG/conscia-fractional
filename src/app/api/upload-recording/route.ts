import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

type UploadRequestBody = {
  path?: string;
  contentType?: string;
};

type DeleteRequestBody = {
  path?: string;
};

async function getAuthenticatedUser() {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Not authenticated" as const, status: 401 as const };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" as const, status: 401 as const };
  }

  return { user };
}

function validateUserPath(path: string | null | undefined, userId: string) {
  if (!path) {
    return "Missing path";
  }

  if (!path.startsWith(`${userId}/`)) {
    return "Invalid path";
  }

  return null;
}

function parseExpiresIn(value: string | null): number {
  if (!value) return 60 * 60 * 24;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 60 * 60 * 24;
  return Math.min(parsed, 60 * 60 * 24 * 365);
}

/**
 * Returns a signed upload URL so the client can upload directly to Supabase
 * Storage, bypassing both the Next.js body size limit and the Supabase API
 * gateway's 50 MB proxy limit.
 */
export async function POST(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as UploadRequestBody;
  const { path, contentType } = body;

  const pathError = validateUserPath(path, auth.user.id);
  if (pathError) {
    return NextResponse.json(
      { error: pathError },
      { status: pathError === "Missing path" ? 400 : 403 },
    );
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
    .createSignedUploadUrl(path!);

  if (error || !data) {
    return NextResponse.json(
      { error: `Failed to create upload URL: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({
    token: data.token,
    path: data.path,
    signedUploadUrl: data.signedUrl,
    signedUrl: data.signedUrl,
    contentType: contentType || "audio/mpeg",
  });
}

export async function GET(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const path = request.nextUrl.searchParams.get("path");
  const pathError = validateUserPath(path, auth.user.id);
  if (pathError) {
    return NextResponse.json(
      { error: pathError },
      { status: pathError === "Missing path" ? 400 : 403 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const expiresIn = parseExpiresIn(request.nextUrl.searchParams.get("expires"));
  const { data, error } = await admin.storage
    .from("meeting-recordings")
    .createSignedUrl(path!, expiresIn);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: `Failed to create read URL: ${error?.message ?? "unknown"}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path });
}

export async function DELETE(request: NextRequest) {
  const auth = await getAuthenticatedUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = (await request.json()) as DeleteRequestBody;
  const pathError = validateUserPath(body.path, auth.user.id);
  if (pathError) {
    return NextResponse.json(
      { error: pathError },
      { status: pathError === "Missing path" ? 400 : 403 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { error } = await admin.storage
    .from("meeting-recordings")
    .remove([body.path!]);

  if (error) {
    return NextResponse.json(
      { error: `Failed to delete recording: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAuthUrl } from "@/lib/services/google-auth-service";

const SCOPE_PREFIX = "https://www.googleapis.com/auth/";

const DEFAULT_SCOPE = "drive.readonly";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const scopeParam = searchParams.get("scopes") ?? DEFAULT_SCOPE;

  const scopes = scopeParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith("https://") ? s : `${SCOPE_PREFIX}${s}`));

  const state = crypto.randomUUID();

  const authUrl = generateAuthUrl(scopes, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("google_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });

  return response;
}

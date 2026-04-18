import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateAuthUrl,
  generatePkcePair,
} from "@/lib/services/slack-auth-service";

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

  const state = crypto.randomUUID();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  let authUrl: string;
  try {
    authUrl = generateAuthUrl(state, codeChallenge);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Slack config error";
    console.error("Slack auth failed:", message);
    const settingsUrl = new URL("/settings", request.url);
    settingsUrl.searchParams.set("slack", "error");
    settingsUrl.searchParams.set("message", message);
    return NextResponse.redirect(settingsUrl);
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("slack_oauth_state", state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });
  response.cookies.set("slack_pkce_verifier", codeVerifier, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    path: "/",
  });

  return response;
}

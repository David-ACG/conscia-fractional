import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, storeTokens } from "@/lib/services/slack-auth-service";

const SETTINGS_URL = "/settings";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  // If Slack redirected us to the public tunnel URL, forward the browser back
  // to localhost so the state/verifier cookies (set at localhost) are readable.
  if (
    requestUrl.hostname.endsWith("trycloudflare.com") ||
    requestUrl.hostname.endsWith("ngrok-free.app") ||
    requestUrl.hostname.endsWith("ngrok.io")
  ) {
    const localUrl = new URL(
      "https://localhost:3002/api/auth/slack/callback",
    );
    searchParams.forEach((v, k) => localUrl.searchParams.set(k, v));
    return NextResponse.redirect(localUrl);
  }

  if (!code) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?slack=error&message=missing_code`, request.url),
    );
  }

  // CSRF check — validate state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get("slack_oauth_state")?.value;
  const codeVerifier = cookieStore.get("slack_pkce_verifier")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?slack=error&message=invalid_state`, request.url),
    );
  }

  // Clear the state + verifier cookies
  cookieStore.delete("slack_oauth_state");
  cookieStore.delete("slack_pkce_verifier");

  // Get authenticated user
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

  try {
    const { bot_token, user_token, team_name, team_id } = await exchangeCode(
      code,
      codeVerifier,
    );

    await storeTokens(user.id, bot_token, user_token, team_name, team_id);

    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?slack=connected`, request.url),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?slack=error&message=${encodeURIComponent(message)}`,
        request.url,
      ),
    );
  }
}

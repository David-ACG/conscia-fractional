import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCode,
  getGoogleUserEmail,
  storeTokens,
} from "@/lib/services/google-auth-service";

const SETTINGS_URL = "/dashboard/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=missing_code`, request.url),
    );
  }

  // CSRF check — validate state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get("google_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=invalid_state`, request.url),
    );
  }

  // Clear the state cookie
  cookieStore.delete("google_oauth_state");

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
    const tokens = await exchangeCode(code);

    if (!tokens.refresh_token) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=no_refresh_token`, request.url),
      );
    }

    const email = await getGoogleUserEmail(tokens.access_token);

    await storeTokens(user.id, email, tokens);

    const successUrl = new URL(SETTINGS_URL, request.url);
    successUrl.searchParams.set("google", "connected");
    successUrl.searchParams.set("email", email);
    return NextResponse.redirect(successUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";

    if (message.includes("exchange")) {
      return NextResponse.redirect(
        new URL(`${SETTINGS_URL}?error=exchange_failed`, request.url),
      );
    }

    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=unknown`, request.url),
    );
  }
}

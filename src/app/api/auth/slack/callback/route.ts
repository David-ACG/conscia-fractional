import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, storeTokens } from "@/lib/services/slack-auth-service";

const SETTINGS_URL = "/dashboard/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?slack=error&message=missing_code`, request.url),
    );
  }

  // CSRF check — validate state against cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get("slack_oauth_state")?.value;

  if (!storedState || storedState !== state) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?slack=error&message=invalid_state`, request.url),
    );
  }

  // Clear the state cookie
  cookieStore.delete("slack_oauth_state");

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
    const { bot_token, user_token, team_name, team_id } =
      await exchangeCode(code);

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

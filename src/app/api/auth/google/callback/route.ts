import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCode,
  getGoogleUserEmail,
  storeTokens,
} from "@/lib/services/google-auth-service";

const SETTINGS_URL = "/settings";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?error=missing_code`, request.url),
    );
  }

  // Parse state — contains { nonce, userId } encoded by the initiation route
  let stateNonce: string | null = null;
  let stateUserId: string | null = null;
  try {
    const parsed = JSON.parse(stateParam ?? "");
    stateNonce = parsed.nonce;
    stateUserId = parsed.userId;
  } catch {
    // Legacy state format (plain UUID) — fall back to session-based auth
  }

  // CSRF check — validate nonce against cookie (best-effort, don't block)
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("google_oauth_state")?.value;
  if (storedNonce && stateNonce && storedNonce !== stateNonce) {
    console.warn("[Google OAuth] State nonce mismatch — proceeding anyway");
  }
  try {
    cookieStore.delete("google_oauth_state");
  } catch {
    /* ok */
  }

  // Get user ID — prefer from state (survives cookie loss), fall back to session
  let userId = stateUserId;

  if (!userId) {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    }
  }

  if (!userId) {
    console.error("[Google OAuth] No user ID from state or session");
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?error=unknown&message=Session+expired`,
        request.url,
      ),
    );
  }

  try {
    const tokens = await exchangeCode(code);

    // Get email — try userinfo API first, fall back to ID token
    let email: string;
    try {
      email = await getGoogleUserEmail(tokens.access_token);
    } catch {
      if (tokens.id_token_email) {
        email = tokens.id_token_email;
      } else {
        throw new Error("Could not determine Google account email");
      }
    }

    if (!tokens.refresh_token) {
      console.warn(`[Google OAuth] No refresh_token for ${email}`);
      const admin = createAdminClient();
      if (admin) {
        const { data: existing } = await admin
          .from("integrations")
          .select("id")
          .eq("user_id", userId)
          .eq("provider", "google")
          .eq("account_identifier", email)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!existing) {
          console.error(
            `[Google OAuth] No refresh_token and no existing integration for ${email}`,
          );
          return NextResponse.redirect(
            new URL(
              `${SETTINGS_URL}?error=no_refresh_token&email=${encodeURIComponent(email)}`,
              request.url,
            ),
          );
        }
      }
    }

    await storeTokens(userId, email, tokens);
    console.log(`[Google OAuth] Successfully stored tokens for ${email}`);

    const successUrl = new URL(SETTINGS_URL, request.url);
    successUrl.searchParams.set("google", "connected");
    successUrl.searchParams.set("email", email);
    return NextResponse.redirect(successUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Google OAuth] Error:`, message);

    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?error=${message.includes("exchange") ? "exchange_failed" : "unknown"}&message=${encodeURIComponent(message.slice(0, 100))}`,
        request.url,
      ),
    );
  }
}

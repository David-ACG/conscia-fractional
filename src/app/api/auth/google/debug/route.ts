import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeCode,
  getGoogleUserEmail,
  storeTokens,
} from "@/lib/services/google-auth-service";

/**
 * Debug version of the Google OAuth callback.
 * Instead of redirecting, it renders a full HTML page showing every step.
 * Use by temporarily changing GOOGLE_REDIRECT_URI to:
 *   http://localhost:3002/api/auth/google/debug
 */
export async function GET(request: NextRequest) {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toISOString()}] ${msg}`);
  };

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const errorParam = searchParams.get("error");

  log(
    `URL params: code=${code ? "present" : "MISSING"}, state=${stateParam ? "present" : "MISSING"}, error=${errorParam ?? "none"}`,
  );

  if (errorParam) {
    log(`Google returned error: ${errorParam}`);
    return renderDebugPage(logs, "Google returned an error");
  }

  if (!code) {
    log("No authorization code received");
    return renderDebugPage(logs, "No code");
  }

  // Check state
  let stateNonce: string | null = null;
  let stateUserId: string | null = null;
  try {
    const parsed = JSON.parse(stateParam ?? "");
    stateNonce = parsed.nonce;
    stateUserId = parsed.userId;
    log(
      `State parsed: nonce=${stateNonce?.slice(0, 8)}..., userId=${stateUserId}`,
    );
  } catch {
    log(`State parse failed: raw="${stateParam}"`);
  }

  // Check cookies
  const cookieStore = await cookies();
  const allCookieNames = cookieStore.getAll().map((c) => c.name);
  log(`Cookies present: ${allCookieNames.join(", ") || "NONE"}`);

  const storedNonce = cookieStore.get("google_oauth_state")?.value;
  log(
    `State cookie: ${storedNonce ? storedNonce.slice(0, 8) + "..." : "MISSING"}`,
  );
  log(`State match: ${storedNonce === stateNonce ? "YES" : "NO"}`);

  // Check Supabase session
  let sessionUserId: string | null = null;
  try {
    const supabase = await createClient();
    if (supabase) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      sessionUserId = user?.id ?? null;
      log(`Supabase session: ${sessionUserId ?? "NO USER"}`);
    } else {
      log("Supabase client creation failed");
    }
  } catch (err) {
    log(`Supabase session error: ${err}`);
  }

  const userId = stateUserId ?? sessionUserId;
  log(
    `Final userId: ${userId ?? "NONE"} (source: ${stateUserId ? "state" : sessionUserId ? "session" : "NONE"})`,
  );

  if (!userId) {
    log("FATAL: No user ID available");
    return renderDebugPage(logs, "No user ID");
  }

  // Exchange code
  let tokens: Awaited<ReturnType<typeof exchangeCode>>;
  try {
    tokens = await exchangeCode(code);
    log(
      `Token exchange: access_token=${tokens.access_token ? "present" : "MISSING"}, refresh_token=${tokens.refresh_token ? "present" : "MISSING"}, scope=${tokens.scope}, id_token_email=${tokens.id_token_email ?? "none"}`,
    );
  } catch (err) {
    log(
      `Token exchange FAILED: ${err instanceof Error ? err.message : String(err)}`,
    );
    return renderDebugPage(logs, "Token exchange failed");
  }

  // Get email — try userinfo API first, fall back to ID token
  let email: string;
  try {
    email = await getGoogleUserEmail(tokens.access_token);
    log(`User email (from userinfo): ${email}`);
  } catch (err) {
    log(
      `Userinfo fetch failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    if (tokens.id_token_email) {
      email = tokens.id_token_email;
      log(`User email (from ID token fallback): ${email}`);
    } else {
      log("FATAL: No email from userinfo or ID token");
      return renderDebugPage(logs, "Email fetch failed");
    }
  }

  // Check refresh token
  if (!tokens.refresh_token) {
    log("WARNING: No refresh_token — checking for existing integration");
    const admin = createAdminClient();
    if (admin) {
      const { data: existing, error: existErr } = await admin
        .from("integrations")
        .select("id")
        .eq("user_id", userId)
        .eq("provider", "google")
        .eq("account_identifier", email)
        .eq("is_active", true)
        .limit(1)
        .single();

      log(
        `Existing integration: ${existing ? existing.id : "NONE"} (error: ${existErr?.message ?? "none"})`,
      );

      if (!existing) {
        log(
          "FATAL: No refresh_token and no existing integration — cannot save",
        );
        return renderDebugPage(logs, "No refresh token for new account");
      }
    }
  }

  // Store tokens
  try {
    await storeTokens(userId, email, tokens);
    log(`Tokens stored successfully for ${email}`);
  } catch (err) {
    log(
      `Store tokens FAILED: ${err instanceof Error ? err.message : String(err)}`,
    );
    return renderDebugPage(logs, "Store tokens failed");
  }

  // Verify storage
  const admin = createAdminClient();
  if (admin) {
    const { data: check } = await admin
      .from("integrations")
      .select("id, account_identifier, scopes, is_active")
      .eq("user_id", userId)
      .eq("provider", "google")
      .eq("account_identifier", email)
      .single();
    log(`Verification: ${check ? JSON.stringify(check) : "NOT FOUND"}`);
  }

  log("SUCCESS — account connected");
  return renderDebugPage(logs, "Success!", true);
}

function renderDebugPage(logs: string[], status: string, success = false) {
  const html = `<!DOCTYPE html>
<html><head><title>Google OAuth Debug</title>
<style>
  body { font-family: monospace; background: #111; color: #eee; padding: 20px; max-width: 900px; margin: 0 auto; }
  h1 { color: ${success ? "#4ade80" : "#f87171"}; }
  .log { background: #222; padding: 12px; border-radius: 8px; margin: 8px 0; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
  .log .warn { color: #fbbf24; }
  .log .error { color: #f87171; }
  .log .ok { color: #4ade80; }
  a { color: #38bdf8; }
</style></head>
<body>
  <h1>${success ? "✓" : "✗"} ${status}</h1>
  <div class="log">${logs
    .map((l) => {
      if (l.includes("FATAL") || l.includes("FAILED") || l.includes("MISSING"))
        return `<span class="error">${escapeHtml(l)}</span>`;
      if (l.includes("WARNING") || l.includes("NO"))
        return `<span class="warn">${escapeHtml(l)}</span>`;
      if (l.includes("SUCCESS") || l.includes("present") || l.includes("YES"))
        return `<span class="ok">${escapeHtml(l)}</span>`;
      return escapeHtml(l);
    })
    .join("\n")}</div>
  <p><a href="/settings">← Back to Settings</a></p>
</body></html>`;

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

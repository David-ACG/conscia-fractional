import { google } from "googleapis";
import { encrypt, decrypt } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertIntegration } from "@/lib/services/integration-service";

export function createOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function generateAuthUrl(scopes: string[], state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: scopes,
    state,
  });
}

export async function exchangeCode(code: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
  scope: string;
}> {
  const client = createOAuth2Client();
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.access_token) {
      throw new Error("No access token returned from Google");
    }
    return {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      expiry_date: tokens.expiry_date ?? null,
      scope: tokens.scope ?? "",
    };
  } catch (err) {
    throw new Error(
      `Failed to exchange code: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function refreshAccessToken(
  encryptedRefreshToken: string,
): Promise<{
  access_token: string;
  expiry_date: number | null;
}> {
  const refreshToken = decrypt(encryptedRefreshToken);
  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error("No access token returned from refresh");
    }
    return {
      access_token: credentials.access_token,
      expiry_date: credentials.expiry_date ?? null,
    };
  } catch (err) {
    throw new Error(
      `Token refresh failed — re-authorization required: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function getGoogleUserEmail(accessToken: string): Promise<string> {
  const client = createOAuth2Client();
  client.setCredentials({ access_token: accessToken });

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();

  if (!data.email) {
    throw new Error("Could not retrieve email from Google account");
  }
  return data.email;
}

export async function storeTokens(
  userId: string,
  email: string,
  tokens: {
    access_token: string;
    refresh_token: string | null;
    expiry_date: number | null;
    scope: string;
  },
): Promise<void> {
  const scopes = tokens.scope ? tokens.scope.split(" ").filter(Boolean) : [];
  const tokenExpiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date).toISOString()
    : null;

  await upsertIntegration(userId, {
    provider: "google",
    account_identifier: email,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    token_expires_at: tokenExpiresAt,
    scopes,
  });
}

export async function getValidAccessToken(
  integrationId: string,
): Promise<string> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("id", integrationId)
    .single();

  if (error || !data) throw new Error("Integration not found");

  const { access_token_encrypted, refresh_token_encrypted, token_expires_at } =
    data;

  const fiveMinutes = 5 * 60 * 1000;
  const isExpired = token_expires_at
    ? new Date(token_expires_at).getTime() - Date.now() < fiveMinutes
    : false;

  if (!isExpired && access_token_encrypted) {
    return decrypt(access_token_encrypted);
  }

  if (!refresh_token_encrypted) {
    throw new Error("No refresh token available — re-authorization required");
  }

  const { access_token, expiry_date } = await refreshAccessToken(
    refresh_token_encrypted,
  );

  await supabase
    .from("integrations")
    .update({
      access_token_encrypted: encrypt(access_token),
      token_expires_at: expiry_date
        ? new Date(expiry_date).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", integrationId);

  return access_token;
}

export function generateCalendarScopeUrl(state: string): string {
  return generateAuthUrl(
    ["https://www.googleapis.com/auth/calendar.readonly"],
    state,
  );
}

export async function removeIntegration(
  integrationId: string,
  userId: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("integrations")
    .select("id")
    .eq("id", integrationId)
    .eq("user_id", userId)
    .single();

  if (error || !data)
    throw new Error("Integration not found or not owned by user");

  await supabase
    .from("integrations")
    .update({ is_active: false })
    .eq("id", integrationId)
    .eq("user_id", userId);
}

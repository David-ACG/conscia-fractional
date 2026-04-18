import crypto from "node:crypto";
import { encrypt } from "@/lib/encryption";
import { upsertIntegration } from "@/lib/services/integration-service";

// Environment variables needed:
// SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI, SLACK_SIGNING_SECRET

function getSlackEnvVars() {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Slack OAuth environment variables: SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_REDIRECT_URI",
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function generatePkcePair(): {
  codeVerifier: string;
  codeChallenge: string;
} {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function generateAuthUrl(state: string, codeChallenge?: string): string {
  const { clientId, redirectUri } = getSlackEnvVars();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "channels:read,chat:write,groups:read",
    user_scope: "search:read",
    state,
  });

  if (codeChallenge) {
    params.set("code_challenge", codeChallenge);
    params.set("code_challenge_method", "S256");
  }

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeCode(
  code: string,
  codeVerifier?: string,
): Promise<{
  bot_token: string;
  user_token: string;
  team_name: string;
  team_id: string;
}> {
  const { clientId, clientSecret, redirectUri } = getSlackEnvVars();

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  if (codeVerifier) {
    params.set("code_verifier", codeVerifier);
  }

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Slack OAuth request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    ok: boolean;
    error?: string;
    access_token?: string;
    team?: { id: string; name: string };
    authed_user?: { access_token?: string };
  };

  if (!data.ok) {
    throw new Error(
      `Slack OAuth exchange failed: ${data.error ?? "unknown_error"}`,
    );
  }

  const botToken = data.access_token;
  const userToken = data.authed_user?.access_token ?? "";
  const teamName = data.team?.name ?? data.team?.id ?? "Unknown workspace";
  const teamId = data.team?.id;

  if (!botToken) throw new Error("No bot token returned from Slack");
  if (!teamId) throw new Error("No team ID returned from Slack");

  return {
    bot_token: botToken,
    user_token: userToken,
    team_name: teamName,
    team_id: teamId,
  };
}

export async function storeTokens(
  userId: string,
  botToken: string,
  userToken: string,
  teamName: string,
  teamId: string,
): Promise<void> {
  const metadata: Record<string, unknown> = { team_id: teamId };
  if (userToken) {
    metadata.user_token_encrypted = encrypt(userToken);
  }

  await upsertIntegration(userId, {
    provider: "slack",
    account_identifier: teamName,
    access_token: botToken,
    scopes: ["channels:read", "chat:write", "groups:read"],
    metadata,
  });
}

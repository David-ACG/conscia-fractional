import { encrypt, decrypt } from "@/lib/encryption";
import { createAdminClient } from "@/lib/supabase/admin";

export type TrelloCredentials = {
  apiKey: string;
  token: string;
  username: string;
};

export function buildAuthorizeUrl(apiKey: string, returnUrl: string): string {
  const appName = process.env.TRELLO_APP_NAME || "FractionalBuddy";
  const params = new URLSearchParams({
    expiration: "never",
    scope: "read,write",
    response_type: "token",
    name: appName,
    key: apiKey,
    return_url: returnUrl,
  });
  return `https://trello.com/1/authorize?${params.toString()}`;
}

export async function fetchMemberInfo(
  apiKey: string,
  token: string,
): Promise<{ username: string; fullName: string }> {
  const params = new URLSearchParams({
    key: apiKey,
    token,
    fields: "username,fullName",
  });
  const response = await fetch(
    `https://api.trello.com/1/members/me?${params.toString()}`,
  );

  if (!response.ok) {
    throw new Error(`Trello member info request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    username?: string;
    fullName?: string;
  };

  return {
    username: data.username ?? "",
    fullName: data.fullName ?? "",
  };
}

export async function storeCredentials(
  userId: string,
  apiKey: string,
  token: string,
  username: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const row = {
    user_id: userId,
    provider: "trello",
    account_identifier: username,
    access_token_encrypted: encrypt(token),
    scopes: ["read", "write"],
    metadata: { api_key_encrypted: encrypt(apiKey) },
    is_active: true,
  };

  const { error } = await supabase
    .from("integrations")
    .upsert(row, { onConflict: "user_id,provider,account_identifier" });

  if (error) throw error;
}

export async function getCredentials(
  userId: string,
): Promise<TrelloCredentials | null> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "trello")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  if (!data) return null;

  const encryptedApiKey = (data.metadata as { api_key_encrypted?: string })
    ?.api_key_encrypted;
  if (!encryptedApiKey || !data.access_token_encrypted) return null;

  return {
    apiKey: decrypt(encryptedApiKey),
    token: decrypt(data.access_token_encrypted),
    username: data.account_identifier ?? "",
  };
}

export async function disconnect(userId: string): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("user_id", userId)
    .eq("provider", "trello");

  if (error) throw error;
}

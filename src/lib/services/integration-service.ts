import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/encryption";

export interface Integration {
  id: string;
  user_id: string;
  provider: string;
  account_identifier: string | null;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[];
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DecryptedIntegration extends Omit<
  Integration,
  "access_token_encrypted" | "refresh_token_encrypted"
> {
  access_token: string | null;
  refresh_token: string | null;
}

export interface UpsertIntegrationData {
  provider: string;
  account_identifier?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

function decryptIntegration(row: Integration): DecryptedIntegration {
  const { access_token_encrypted, refresh_token_encrypted, ...rest } = row;
  return {
    ...rest,
    access_token: access_token_encrypted
      ? decrypt(access_token_encrypted)
      : null,
    refresh_token: refresh_token_encrypted
      ? decrypt(refresh_token_encrypted)
      : null,
  };
}

export async function getIntegrations(
  userId: string,
): Promise<DecryptedIntegration[]> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw error;
  if (!data) return [];

  return data.map((row: Integration) => decryptIntegration(row));
}

export async function getIntegration(
  userId: string,
  provider: string,
): Promise<DecryptedIntegration | null> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { data, error } = await supabase
    .from("integrations")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  if (!data) return null;

  return decryptIntegration(data as Integration);
}

export async function upsertIntegration(
  userId: string,
  data: UpsertIntegrationData,
): Promise<DecryptedIntegration> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const row: Record<string, unknown> = {
    user_id: userId,
    provider: data.provider,
    account_identifier: data.account_identifier ?? null,
    token_expires_at: data.token_expires_at ?? null,
    scopes: data.scopes ?? [],
    metadata: data.metadata ?? {},
    is_active: true,
  };

  if (data.access_token) {
    row.access_token_encrypted = encrypt(data.access_token);
  }
  if (data.refresh_token) {
    row.refresh_token_encrypted = encrypt(data.refresh_token);
  }

  const { data: result, error } = await supabase
    .from("integrations")
    .upsert(row, { onConflict: "user_id,provider,account_identifier" })
    .select("*")
    .single();

  if (error) throw error;

  return decryptIntegration(result as Integration);
}

export async function deleteIntegration(
  userId: string,
  integrationId: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const { error } = await supabase
    .from("integrations")
    .update({ is_active: false })
    .eq("id", integrationId)
    .eq("user_id", userId);

  if (error) throw error;
}

export function refreshTokenIfNeeded(integration: DecryptedIntegration): {
  needsRefresh: boolean;
} {
  if (!integration.token_expires_at) return { needsRefresh: false };

  const expiresAt = new Date(integration.token_expires_at);
  const now = new Date();
  const fiveMinutes = 5 * 60 * 1000;

  return { needsRefresh: expiresAt.getTime() - now.getTime() < fiveMinutes };
}

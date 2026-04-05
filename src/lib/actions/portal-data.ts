"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getPortalClientId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  const { data: role } = await admin
    .from("user_roles")
    .select("client_id")
    .eq("user_id", user.id)
    .eq("role", "client")
    .single();

  return role?.client_id ?? null;
}

export async function getPortalEnabledModules(
  clientId: string,
): Promise<string[]> {
  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("client_portal_settings")
    .select("module")
    .eq("client_id", clientId)
    .eq("is_enabled", true);

  return (data ?? []).map((r) => r.module);
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteIntegration } from "@/lib/services/integration-service";
import { removeIntegration } from "@/lib/services/google-auth-service";

export async function disconnectIntegration(integrationId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Not authenticated" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await deleteIntegration(user.id, integrationId);
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "Failed to disconnect integration" };
  }
}

export async function getGoogleIntegrations() {
  const supabase = await createClient();
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const admin = createAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("integrations")
    .select("id, account_identifier, provider")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .order("created_at", { ascending: false });

  return (data ?? []) as {
    id: string;
    account_identifier: string;
    provider: string;
  }[];
}

export async function removeGoogleIntegration(integrationId: string) {
  const supabase = await createClient();
  if (!supabase) return { error: "Not authenticated" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  try {
    await removeIntegration(integrationId, user.id);
    revalidatePath("/settings");
    return { success: true };
  } catch {
    return { error: "Failed to disconnect Google account" };
  }
}

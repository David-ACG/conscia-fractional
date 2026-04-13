"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";

export async function getPortalClientId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  // Check for client role first
  const { data: role } = await admin
    .from("user_roles")
    .select("client_id")
    .eq("user_id", user.id)
    .eq("role", "client")
    .single();

  if (role?.client_id) return role.client_id;

  // Check if preview mode cookie is set (consultant previewing)
  const cookieStore = await cookies();
  const previewCookie = cookieStore.get("portal_preview")?.value;
  if (previewCookie === "true") {
    return getPreviewClientId();
  }

  return null;
}

/**
 * Check if the current user is a consultant previewing the portal.
 * Returns the active client ID if preview is valid, null otherwise.
 */
export async function getPreviewClientId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  if (!admin) return null;

  // Verify user is a consultant (any non-client role)
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id);

  const isConsultant = (roles ?? []).some((r) => r.role !== "client");
  if (!isConsultant) return null;

  // Use consultant's active client
  return getActiveClientId();
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

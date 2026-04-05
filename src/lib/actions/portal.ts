"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  portalSettingsUpdateSchema,
  portalInviteSchema,
} from "@/lib/validations/portal";
import type { PortalSettings, PortalInvitation } from "@/lib/types";

export async function getPortalSettings(
  clientId: string,
): Promise<{ data?: PortalSettings[]; error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { data, error } = await supabase
    .from("client_portal_settings")
    .select("*")
    .eq("client_id", clientId)
    .order("module");

  if (error) return { error: error.message };
  return { data: data as PortalSettings[] };
}

export async function updatePortalSetting(
  clientId: string,
  module: string,
  isEnabled: boolean,
): Promise<{ success?: boolean; error?: string }> {
  const parsed = portalSettingsUpdateSchema.safeParse({
    module,
    is_enabled: isEnabled,
  });
  if (!parsed.success) return { error: "Invalid module or value" };

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("client_portal_settings")
    .update({ is_enabled: parsed.data.is_enabled })
    .eq("client_id", clientId)
    .eq("module", parsed.data.module);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

export async function getPortalInvitations(
  clientId: string,
): Promise<{ data?: PortalInvitation[]; error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { data, error } = await supabase
    .from("portal_invitations")
    .select("*")
    .eq("client_id", clientId)
    .order("invited_at", { ascending: false });

  if (error) return { error: error.message };
  return { data: data as PortalInvitation[] };
}

export async function invitePortalUser(
  clientId: string,
  email: string,
): Promise<{ success?: boolean; link?: string; error?: string }> {
  const parsed = portalInviteSchema.safeParse({ email });
  if (!parsed.success) return { error: "Valid email required" };

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  // 1. Insert invitation record
  const { error: inviteError } = await supabase
    .from("portal_invitations")
    .insert({
      client_id: clientId,
      email: parsed.data.email,
      invited_by: (await supabase.auth.getUser()).data.user?.id,
    });

  if (inviteError) return { error: inviteError.message };

  // 2. Create or get user via admin API and set up role
  const { data: existingUsers } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("client_id", clientId);

  // Check if user already has a role for this client
  const { data: authUser } = await supabase.auth.admin.getUserByEmail(
    parsed.data.email,
  );

  let userId: string;
  if (authUser?.user) {
    userId = authUser.user.id;
  } else {
    // Create the user
    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: parsed.data.email,
        email_confirm: true,
      });
    if (createError || !newUser.user) {
      return { error: createError?.message || "Failed to create user" };
    }
    userId = newUser.user.id;
  }

  // 3. Insert user_roles entry (ignore conflict if already exists)
  const hasRole = existingUsers?.some((r) => r.user_id === userId);
  if (!hasRole) {
    await supabase.from("user_roles").insert({
      user_id: userId,
      role: "client",
      client_id: clientId,
    });
  }

  // 4. Update invitation with auth_user_id
  await supabase
    .from("portal_invitations")
    .update({ auth_user_id: userId })
    .eq("client_id", clientId)
    .eq("email", parsed.data.email);

  // 5. Generate magic link
  const { data: linkData, error: linkError } =
    await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: parsed.data.email,
    });

  if (linkError) return { error: linkError.message };

  revalidatePath("/settings");
  return {
    success: true,
    link: linkData.properties.action_link,
  };
}

export async function revokePortalUser(
  invitationId: string,
): Promise<{ success?: boolean; error?: string }> {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  // Get the invitation to find the user
  const { data: invitation, error: fetchError } = await supabase
    .from("portal_invitations")
    .select("auth_user_id, client_id")
    .eq("id", invitationId)
    .single();

  if (fetchError) return { error: fetchError.message };

  // Set status to revoked
  const { error: updateError } = await supabase
    .from("portal_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId);

  if (updateError) return { error: updateError.message };

  // Remove user_roles entry if user exists
  if (invitation.auth_user_id) {
    await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", invitation.auth_user_id)
      .eq("client_id", invitation.client_id);
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function getEnabledModules(): Promise<{
  data?: string[];
  error?: string;
}> {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  // For consultants, use the active client cookie
  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client" };

  const { data, error } = await supabase
    .from("client_portal_settings")
    .select("module")
    .eq("client_id", clientId)
    .eq("is_enabled", true);

  if (error) return { error: error.message };
  return { data: (data || []).map((r) => r.module) };
}

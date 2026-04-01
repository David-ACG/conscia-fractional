"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { assetSchema, type AssetFormData } from "@/lib/validations/assets";

export async function createAsset(data: AssetFormData) {
  const parsed = assetSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { error } = await supabase.from("assets").insert({
    client_id: clientId,
    name: parsed.data.name,
    description: parsed.data.description || null,
    asset_type: parsed.data.asset_type,
    file_url: parsed.data.file_url || null,
    file_name: parsed.data.file_name || null,
    crm_customer_id: parsed.data.crm_customer_id || null,
    is_client_visible: parsed.data.is_client_visible,
  });

  if (error) return { error: error.message };

  revalidatePath("/assets");
  return { success: true };
}

export async function updateAsset(id: string, data: AssetFormData) {
  const parsed = assetSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("assets")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      asset_type: parsed.data.asset_type,
      file_url: parsed.data.file_url || null,
      file_name: parsed.data.file_name || null,
      crm_customer_id: parsed.data.crm_customer_id || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/assets");
  return { success: true };
}

export async function deleteAsset(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("assets").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/assets");
  return { success: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  deliverableSchema,
  type DeliverableFormData,
  newVersionSchema,
  type NewVersionFormData,
} from "@/lib/validations/deliverables";
import type { DeliverableVersion } from "@/lib/types";

export async function createDeliverable(data: DeliverableFormData) {
  const parsed = deliverableSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { data: inserted, error } = await supabase
    .from("deliverables")
    .insert({
      client_id: clientId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      crm_customer_id: parsed.data.crm_customer_id || null,
      status: parsed.data.status,
      due_date: parsed.data.due_date || null,
      file_url: parsed.data.file_url || null,
      file_name: parsed.data.file_name || null,
      version: 1,
      is_client_visible: parsed.data.is_client_visible,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Create initial version entry
  await supabase.from("deliverable_versions").insert({
    deliverable_id: inserted.id,
    version: 1,
    notes: "Initial version",
    file_url: parsed.data.file_url || null,
    file_name: parsed.data.file_name || null,
  });

  revalidatePath("/deliverables");
  return { success: true };
}

export async function updateDeliverable(id: string, data: DeliverableFormData) {
  const parsed = deliverableSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("deliverables")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      crm_customer_id: parsed.data.crm_customer_id || null,
      status: parsed.data.status,
      due_date: parsed.data.due_date || null,
      file_url: parsed.data.file_url || null,
      file_name: parsed.data.file_name || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/deliverables");
  return { success: true };
}

export async function deleteDeliverable(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("deliverables").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/deliverables");
  return { success: true };
}

export async function createNewVersion(
  deliverableId: string,
  data: NewVersionFormData,
) {
  const parsed = newVersionSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  // Get current version
  const { data: deliverable, error: fetchError } = await supabase
    .from("deliverables")
    .select("version")
    .eq("id", deliverableId)
    .single();

  if (fetchError || !deliverable) return { error: "Deliverable not found" };

  const newVersion = deliverable.version + 1;

  // Update deliverable version number (and file if provided)
  const updateData: Record<string, unknown> = { version: newVersion };
  if (parsed.data.file_url) {
    updateData.file_url = parsed.data.file_url;
    updateData.file_name = parsed.data.file_name || null;
  }

  const { error: updateError } = await supabase
    .from("deliverables")
    .update(updateData)
    .eq("id", deliverableId);

  if (updateError) return { error: updateError.message };

  // Insert version history row
  const { error: versionError } = await supabase
    .from("deliverable_versions")
    .insert({
      deliverable_id: deliverableId,
      version: newVersion,
      notes: parsed.data.notes || null,
      file_url: parsed.data.file_url || null,
      file_name: parsed.data.file_name || null,
    });

  if (versionError) return { error: versionError.message };

  revalidatePath("/deliverables");
  return { success: true };
}

export async function getVersionHistory(
  deliverableId: string,
): Promise<DeliverableVersion[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("deliverable_versions")
    .select("*")
    .eq("deliverable_id", deliverableId)
    .order("version", { ascending: false });

  return (data ?? []) as DeliverableVersion[];
}

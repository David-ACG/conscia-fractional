"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  crmCustomerSchema,
  type CrmCustomerFormData,
} from "@/lib/validations/crm";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function createCustomer(data: CrmCustomerFormData) {
  const parsed = crmCustomerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { error } = await supabase.from("crm_customers").insert({
    client_id: clientId,
    name: parsed.data.name,
    slug: generateSlug(parsed.data.name),
    website: parsed.data.website || null,
    industry: parsed.data.industry || null,
    description: parsed.data.description || null,
    status: parsed.data.status,
    primary_contact: parsed.data.primary_contact || null,
    google_drive_url: parsed.data.google_drive_url || null,
    is_client_visible: parsed.data.is_client_visible,
  });

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { success: true };
}

export async function updateCustomer(id: string, data: CrmCustomerFormData) {
  const parsed = crmCustomerSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("crm_customers")
    .update({
      name: parsed.data.name,
      slug: generateSlug(parsed.data.name),
      website: parsed.data.website || null,
      industry: parsed.data.industry || null,
      description: parsed.data.description || null,
      status: parsed.data.status,
      primary_contact: parsed.data.primary_contact || null,
      google_drive_url: parsed.data.google_drive_url || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { success: true };
}

export async function deleteCustomer(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("crm_customers").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/crm");
  return { success: true };
}

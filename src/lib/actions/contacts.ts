"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  contactSchema,
  type ContactFormData,
} from "@/lib/validations/contacts";

export async function createContact(data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { error } = await supabase.from("contacts").insert({
    client_id: clientId,
    name: parsed.data.name,
    role: parsed.data.role || null,
    email: parsed.data.email || null,
    phone: parsed.data.phone || null,
    slack_id: parsed.data.slack_id || null,
    linkedin_url: parsed.data.linkedin_url || null,
    preferred_contact_method: parsed.data.preferred_contact_method,
    skills: parsed.data.skills,
    working_on: parsed.data.working_on || null,
    notes: parsed.data.notes || null,
    is_client_visible: parsed.data.is_client_visible,
  });

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { success: true };
}

export async function updateContact(id: string, data: ContactFormData) {
  const parsed = contactSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("contacts")
    .update({
      name: parsed.data.name,
      role: parsed.data.role || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      slack_id: parsed.data.slack_id || null,
      linkedin_url: parsed.data.linkedin_url || null,
      preferred_contact_method: parsed.data.preferred_contact_method,
      skills: parsed.data.skills,
      working_on: parsed.data.working_on || null,
      notes: parsed.data.notes || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { success: true };
}

export async function deleteContact(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("contacts").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { success: true };
}

export async function toggleContactVisibility(id: string, isVisible: boolean) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("contacts")
    .update({ is_client_visible: isVisible })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/contacts");
  return { success: true };
}

export async function getAllSkills(): Promise<string[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase.from("contacts").select("skills");

  if (!data) return [];

  const allSkills = new Set<string>();
  for (const row of data) {
    for (const skill of row.skills ?? []) {
      allSkills.add(skill);
    }
  }
  return Array.from(allSkills).sort();
}

"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  researchSchema,
  type ResearchFormData,
} from "@/lib/validations/research";

export async function createResearch(data: ResearchFormData) {
  const parsed = researchSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { error } = await supabase.from("research").insert({
    client_id: clientId,
    title: parsed.data.title,
    content: parsed.data.content || null,
    research_type: parsed.data.research_type,
    tags: parsed.data.tags,
    is_client_visible: parsed.data.is_client_visible,
  });

  if (error) return { error: error.message };

  revalidatePath("/research");
  return { success: true };
}

export async function updateResearch(id: string, data: ResearchFormData) {
  const parsed = researchSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("research")
    .update({
      title: parsed.data.title,
      content: parsed.data.content || null,
      research_type: parsed.data.research_type,
      tags: parsed.data.tags,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/research");
  return { success: true };
}

export async function deleteResearch(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("research").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/research");
  return { success: true };
}

export async function getAllResearchTags(clientId: string): Promise<string[]> {
  const supabase = createClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("research")
    .select("tags")
    .eq("client_id", clientId);

  if (!data) return [];

  const allTags = new Set<string>();
  for (const row of data) {
    for (const tag of row.tags ?? []) {
      allTags.add(tag);
    }
  }
  return Array.from(allTags).sort();
}

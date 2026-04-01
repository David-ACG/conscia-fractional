"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { noteSchema, type NoteFormData } from "@/lib/validations/notes";

export async function createNote(data: NoteFormData) {
  const parsed = noteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { error } = await supabase.from("notes").insert({
    client_id: clientId,
    title: parsed.data.title,
    content: parsed.data.content || null,
    note_type: parsed.data.note_type,
    tags: parsed.data.tags,
    is_client_visible: parsed.data.is_client_visible,
  });

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { success: true };
}

export async function updateNote(id: string, data: NoteFormData) {
  const parsed = noteSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("notes")
    .update({
      title: parsed.data.title,
      content: parsed.data.content || null,
      note_type: parsed.data.note_type,
      tags: parsed.data.tags,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { success: true };
}

export async function deleteNote(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/notes");
  return { success: true };
}

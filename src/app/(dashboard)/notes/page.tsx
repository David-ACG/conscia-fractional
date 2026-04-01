import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { NoteList } from "@/components/notes/note-list";
import type { Note } from "@/lib/types";

async function getNotesData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { notes: [] };

  const supabase = createClient();
  if (!supabase) return { notes: [] };

  const { data } = await supabase
    .from("notes")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return { notes: (data ?? []) as Note[] };
}

export default async function NotesPage() {
  const { notes } = await getNotesData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
      <p className="mt-2 text-muted-foreground">
        Capture decisions, context, and important information.
      </p>
      <div className="mt-6">
        <NoteList notes={notes} />
      </div>
    </div>
  );
}

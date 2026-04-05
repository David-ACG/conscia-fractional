import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PortalEmptyState } from "./portal-empty-state";
import { StickyNote, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";

interface PortalNotesProps {
  clientId: string;
}

const noteTypeVariant: Record<string, "default" | "secondary" | "outline"> = {
  note: "secondary",
  decision: "default",
  context: "outline",
};

export async function PortalNotes({ clientId }: PortalNotesProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: notes } = await admin
    .from("notes")
    .select("id, title, content, note_type, tags, created_at")
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (!notes || notes.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Notes</h1>
        <PortalEmptyState
          icon={<StickyNote className="size-10" />}
          title="No notes shared yet"
          description="Notes will appear here once they are shared with you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Notes</h1>

      <div className="grid gap-4 md:grid-cols-2">
        {notes.map((note) => (
          <details key={note.id} className="group">
            <summary className="cursor-pointer list-none">
              <Card className="h-full transition-colors group-open:border-primary/30">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-snug">
                      {note.title}
                    </CardTitle>
                    <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={noteTypeVariant[note.note_type] ?? "outline"}
                    >
                      {note.note_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), "d MMM yyyy")}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {note.content
                      ? note.content.replace(/[#*_`>\-\[\]]/g, "").slice(0, 200)
                      : "No content."}
                  </p>
                  {(note.tags as string[])?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(note.tags as string[]).map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </summary>

            <Card className="mt-2 border-l-4 border-l-primary/30">
              <CardContent className="py-4">
                {note.content ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{note.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    No content.
                  </p>
                )}
              </CardContent>
            </Card>
          </details>
        ))}
      </div>
    </div>
  );
}

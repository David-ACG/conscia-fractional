"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Note } from "@/lib/types";

const noteTypeConfig: Record<string, { label: string; className: string }> = {
  note: {
    label: "Note",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  decision: {
    label: "Decision",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
  context: {
    label: "Context",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
};

interface NoteCardProps {
  note: Note;
  onClick: (note: Note) => void;
}

export function NoteCard({ note, onClick }: NoteCardProps) {
  const typeInfo = noteTypeConfig[note.note_type];

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(note)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold truncate">{note.title}</h3>
          <Badge
            variant="secondary"
            className={`shrink-0 ${typeInfo.className}`}
          >
            {typeInfo.label}
          </Badge>
        </div>

        {note.content && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
            {note.content.slice(0, 120)}
            {note.content.length > 120 ? "..." : ""}
          </p>
        )}

        {note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <p className="mt-3 text-xs text-muted-foreground">
          {new Date(note.created_at).toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

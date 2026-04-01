"use client";

import * as React from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NoteCard } from "./note-card";
import { NoteForm } from "./note-form";
import type { Note } from "@/lib/types";

const noteTypeConfig: Record<
  string,
  { label: string; className: string; activeClassName: string }
> = {
  note: {
    label: "Note",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
    activeClassName:
      "bg-slate-800 text-slate-100 dark:bg-slate-300 dark:text-slate-800",
  },
  decision: {
    label: "Decision",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50",
    activeClassName:
      "bg-amber-600 text-white dark:bg-amber-400 dark:text-amber-900",
  },
  context: {
    label: "Context",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50",
    activeClassName:
      "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-900",
  },
};

interface NoteListProps {
  notes: Note[];
}

export function NoteList({ notes }: NoteListProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<Note | null>(null);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = { note: 0, decision: 0, context: 0 };
    for (const n of notes) {
      counts[n.note_type] = (counts[n.note_type] ?? 0) + 1;
    }
    return counts;
  }, [notes]);

  const filtered = React.useMemo(() => {
    let result = notes;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((n) => n.note_type === typeFilter);
    }
    return result;
  }, [notes, search, typeFilter]);

  function handleEdit(note: Note) {
    setEditingNote(note);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingNote(null);
  }

  function toggleTypeFilter(type: string) {
    setTypeFilter((prev) => (prev === type ? "all" : type));
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(
            Object.entries(noteTypeConfig) as [
              string,
              typeof noteTypeConfig.note,
            ][]
          ).map(([type, config]) => (
            <button
              key={type}
              onClick={() => toggleTypeFilter(type)}
              className="inline-flex items-center"
            >
              <Badge
                variant="secondary"
                className={`cursor-pointer transition-colors ${
                  typeFilter === type
                    ? config.activeClassName
                    : config.className
                }`}
              >
                {config.label} ({typeCounts[type] ?? 0})
              </Badge>
            </button>
          ))}
        </div>

        <Button
          onClick={() => {
            setEditingNote(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Note
        </Button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || typeFilter !== "all"
              ? "No notes match your filters."
              : "No notes yet. Create one to get started."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((note) => (
            <NoteCard key={note.id} note={note} onClick={handleEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <NoteForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        note={editingNote}
      />
    </>
  );
}

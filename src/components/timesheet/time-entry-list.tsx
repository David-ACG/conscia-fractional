"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/components/timer/category-selector";
import type { TimeEntry } from "@/lib/types";

interface TimeEntryListProps {
  entries: TimeEntry[];
  onUpdate: (id: string, updates: Partial<TimeEntry>) => void;
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDurationHM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TimeEntryList({
  entries,
  onUpdate,
  onDelete,
}: TimeEntryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditDescription(entry.description || "");
  }

  function saveEdit(id: string) {
    onUpdate(id, { description: editDescription });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDescription("");
  }

  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No time entries for this period.
      </div>
    );
  }

  const totalMinutes = entries.reduce(
    (sum, e) => sum + (e.duration_minutes || 0),
    0,
  );

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          {/* Category pill */}
          <Badge variant="secondary" className="shrink-0 gap-1">
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                getCategoryColor(entry.category),
              )}
            />
            {entry.category}
          </Badge>

          {/* Description */}
          <div className="min-w-0 flex-1">
            {editingId === entry.id ? (
              <div className="flex items-center gap-1">
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="h-7 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(entry.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  autoFocus
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => saveEdit(entry.id)}
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={cancelEdit}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground truncate block">
                {entry.description || "No description"}
              </span>
            )}
          </div>

          {/* Time range */}
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatTime(entry.started_at)}
            {entry.stopped_at ? ` – ${formatTime(entry.stopped_at)}` : ""}
          </span>

          {/* Duration */}
          <span className="shrink-0 text-sm font-medium tabular-nums w-14 text-right">
            {formatDurationHM(entry.duration_minutes || 0)}
          </span>

          {/* Billable indicator */}
          {entry.is_billable && (
            <span className="text-xs text-green-600" title="Billable">
              $
            </span>
          )}

          {/* Actions */}
          {editingId !== entry.id && (
            <div className="flex shrink-0 gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => startEdit(entry)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => onDelete(entry.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* Total */}
      <div className="flex items-center justify-end gap-2 border-t pt-2">
        <span className="text-sm font-medium">Total:</span>
        <span className="text-sm font-bold tabular-nums">
          {formatDurationHM(totalMinutes)}
        </span>
      </div>
    </div>
  );
}

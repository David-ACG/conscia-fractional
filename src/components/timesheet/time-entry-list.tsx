"use client";

import { useState, useEffect, useRef } from "react";
import { Pencil, Trash2, Check, X, ChevronDown } from "lucide-react";
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

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short" });
  const date = d.getDate();
  const month = d.toLocaleDateString("en-GB", { month: "short" });
  return `${day} ${date} ${month}`;
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
  const [editCategory, setEditCategory] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");
  const categoryRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on outside click
  useEffect(() => {
    if (!categoryOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target as Node)
      ) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [categoryOpen]);

  // Fetch categories when editing starts
  useEffect(() => {
    if (!editingId) return;
    fetch("/api/timer/categories")
      .then((r) => r.json())
      .then((data) => {
        const cats = (data.categories || []).map(
          (c: { category: string }) => c.category,
        );
        setCategories(cats);
      })
      .catch(() => {});
  }, [editingId]);

  const filteredCategories = categorySearch
    ? categories.filter((c) =>
        c.toLowerCase().includes(categorySearch.toLowerCase()),
      )
    : categories;

  function startEdit(entry: TimeEntry) {
    setEditingId(entry.id);
    setEditDescription(entry.description || "");
    setEditCategory(entry.category || "");
    setCategorySearch("");
    setCategoryOpen(false);
  }

  function saveEdit(id: string) {
    onUpdate(id, { description: editDescription, category: editCategory });
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDescription("");
    setEditCategory("");
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
          {editingId === entry.id ? (
            <>
              {/* Editable category */}
              <div className="relative shrink-0 w-44" ref={categoryRef}>
                <button
                  type="button"
                  className="flex h-7 w-full items-center gap-1 rounded-md border bg-background px-2 text-sm"
                  onClick={() => setCategoryOpen(!categoryOpen)}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      getCategoryColor(editCategory),
                    )}
                  />
                  <span className="flex-1 truncate text-left">
                    {editCategory || "Select..."}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                </button>
                {categoryOpen && (
                  <div className="absolute top-8 left-0 z-50 w-56 rounded-md border bg-popover shadow-lg">
                    <div className="p-1">
                      <Input
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        placeholder="Search or create..."
                        className="h-7 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && categorySearch.trim()) {
                            setEditCategory(categorySearch.trim());
                            setCategoryOpen(false);
                            setCategorySearch("");
                          }
                          if (e.key === "Escape") setCategoryOpen(false);
                        }}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto p-1">
                      {filteredCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent",
                            cat === editCategory && "bg-accent",
                          )}
                          onClick={() => {
                            setEditCategory(cat);
                            setCategoryOpen(false);
                            setCategorySearch("");
                          }}
                        >
                          <span
                            className={cn(
                              "h-2 w-2 shrink-0 rounded-full",
                              getCategoryColor(cat),
                            )}
                          />
                          {cat}
                        </button>
                      ))}
                      {categorySearch.trim() &&
                        !categories.some(
                          (c) =>
                            c.toLowerCase() ===
                            categorySearch.trim().toLowerCase(),
                        ) && (
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent text-muted-foreground"
                            onClick={() => {
                              setEditCategory(categorySearch.trim());
                              setCategoryOpen(false);
                              setCategorySearch("");
                            }}
                          >
                            Create &quot;{categorySearch.trim()}&quot;
                          </button>
                        )}
                      {filteredCategories.length === 0 &&
                        !categorySearch.trim() && (
                          <p className="px-2 py-1 text-xs text-muted-foreground">
                            No categories yet
                          </p>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {/* Editable description */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <Input
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="h-7 text-sm"
                    placeholder="Description"
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
              </div>
            </>
          ) : (
            <>
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
                <span className="text-sm text-muted-foreground truncate block">
                  {entry.description || "No description"}
                </span>
              </div>
            </>
          )}

          {/* Date + Time range */}
          <span className="shrink-0 text-xs text-muted-foreground">
            <span className="font-medium">
              {formatShortDate(entry.started_at)}
            </span>{" "}
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
              £
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

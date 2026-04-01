"use client";

import * as React from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResearchCard } from "./research-card";
import { ResearchForm } from "./research-form";
import type { Research } from "@/lib/types";

const researchTypeConfig: Record<
  string,
  { label: string; className: string; activeClassName: string }
> = {
  architecture: {
    label: "Architecture",
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-900/50",
    activeClassName:
      "bg-purple-600 text-white dark:bg-purple-400 dark:text-purple-900",
  },
  competitor: {
    label: "Competitor",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 hover:bg-orange-200 dark:hover:bg-orange-900/50",
    activeClassName:
      "bg-orange-600 text-white dark:bg-orange-400 dark:text-orange-900",
  },
  technology: {
    label: "Technology",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50",
    activeClassName:
      "bg-blue-600 text-white dark:bg-blue-400 dark:text-blue-900",
  },
  market: {
    label: "Market",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50",
    activeClassName:
      "bg-green-600 text-white dark:bg-green-400 dark:text-green-900",
  },
  other: {
    label: "Other",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700",
    activeClassName:
      "bg-gray-800 text-gray-100 dark:bg-gray-300 dark:text-gray-800",
  },
};

interface ResearchListProps {
  items: Research[];
  allTags: string[];
}

export function ResearchList({ items, allTags }: ResearchListProps) {
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingItem, setEditingItem] = React.useState<Research | null>(null);

  const typeCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const key of Object.keys(researchTypeConfig)) {
      counts[key] = 0;
    }
    for (const item of items) {
      counts[item.research_type] = (counts[item.research_type] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const filtered = React.useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.content && r.content.toLowerCase().includes(q)),
      );
    }
    if (typeFilter !== "all") {
      result = result.filter((r) => r.research_type === typeFilter);
    }
    return result;
  }, [items, search, typeFilter]);

  function handleEdit(research: Research) {
    setEditingItem(research);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingItem(null);
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
            placeholder="Search research..."
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(
            Object.entries(researchTypeConfig) as [
              string,
              typeof researchTypeConfig.architecture,
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
            setEditingItem(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Research
        </Button>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || typeFilter !== "all"
              ? "No research items match your filters."
              : "No research yet. Add your first research item to get started."}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((item) => (
            <ResearchCard key={item.id} research={item} onClick={handleEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit dialog */}
      <ResearchForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        research={editingItem}
        allTags={allTags}
      />
    </>
  );
}

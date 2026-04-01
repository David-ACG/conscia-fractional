"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

// 12-color palette for category dots
const CATEGORY_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-yellow-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-teal-500",
  "bg-emerald-500",
  "bg-amber-500",
];

function hashCategory(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getCategoryColor(name: string): string {
  return (
    CATEGORY_COLORS[hashCategory(name) % CATEGORY_COLORS.length] ??
    "bg-blue-500"
  );
}

export interface RankedCategory {
  category: string;
  count: number;
  lastUsed: string;
  avgHour: number;
  score: number;
}

interface CategorySelectorProps {
  value: string | null;
  onSelect: (category: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}

export function CategorySelector({
  value,
  onSelect,
  open,
  onOpenChange,
  className,
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<RankedCategory[]>([]);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    async function load() {
      try {
        const res = await fetch("/api/timer/categories");
        if (!res.ok) return;
        const data = await res.json();
        setCategories(data.categories || []);
      } catch {
        // use empty list
      }
    }
    load();
  }, [open]);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch("");
      // Focus input after render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const fuse = useMemo(
    () =>
      new Fuse(categories, {
        keys: ["category"],
        threshold: 0.4,
      }),
    [categories],
  );

  const filtered = useMemo(() => {
    if (!search) return categories;
    return fuse.search(search).map((r) => r.item);
  }, [search, categories, fuse]);

  const handleSelect = useCallback(
    (cat: string) => {
      onSelect(cat);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  if (!open) return null;

  const showCreateOption =
    search.trim() &&
    !categories.some(
      (c) => c.category.toLowerCase() === search.trim().toLowerCase(),
    );

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-lg border bg-popover shadow-lg",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      <Command shouldFilter={false}>
        <CommandInput
          ref={inputRef}
          placeholder="Search categories..."
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>
            {search.trim() ? (
              <button
                className="w-full px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => handleSelect(search.trim())}
              >
                Create &quot;{search.trim()}&quot;
              </button>
            ) : (
              "No categories yet"
            )}
          </CommandEmpty>
          <CommandGroup>
            {filtered.map((cat) => (
              <CommandItem
                key={cat.category}
                value={cat.category}
                onSelect={() => handleSelect(cat.category)}
                className={cn(value === cat.category && "bg-accent")}
              >
                <span
                  className={cn(
                    "mr-2 h-2.5 w-2.5 rounded-full",
                    getCategoryColor(cat.category),
                  )}
                />
                <span className="flex-1">{cat.category}</span>
                <span className="text-xs text-muted-foreground">
                  {cat.count}x
                </span>
              </CommandItem>
            ))}
            {showCreateOption && filtered.length > 0 && (
              <CommandItem
                value={`create-${search.trim()}`}
                onSelect={() => handleSelect(search.trim())}
              >
                <span className="mr-2 h-2.5 w-2.5 rounded-full bg-gray-400" />
                Create &quot;{search.trim()}&quot;
              </CommandItem>
            )}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}

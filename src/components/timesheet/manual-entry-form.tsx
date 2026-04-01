"use client";

import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import Fuse from "fuse.js";
import { cn } from "@/lib/utils";
import {
  getCategoryColor,
  type RankedCategory,
} from "@/components/timer/category-selector";

interface ManualEntryFormData {
  date: string;
  startTime: string;
  endTime: string;
  category: string;
  description: string;
  isBillable: boolean;
}

interface ManualEntryFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    date: string;
    startTime: string;
    endTime: string;
    category: string;
    description: string;
    isBillable: boolean;
  }) => void;
  defaultDate?: string;
}

export function ManualEntryForm({
  open,
  onOpenChange,
  onSubmit,
  defaultDate,
}: ManualEntryFormProps) {
  const today = defaultDate || new Date().toISOString().split("T")[0];
  const { register, handleSubmit, reset, setValue, watch } =
    useForm<ManualEntryFormData>({
      defaultValues: {
        date: today,
        startTime: "09:00",
        endTime: "10:00",
        category: "General",
        description: "",
        isBillable: true,
      },
    });

  const [categories, setCategories] = useState<RankedCategory[]>([]);
  const [catSearch, setCatSearch] = useState("");
  const [catDropdownOpen, setCatDropdownOpen] = useState(false);
  const categoryValue = watch("category");

  useEffect(() => {
    if (!open) return;
    reset({
      date: today,
      startTime: "09:00",
      endTime: "10:00",
      category: "General",
      description: "",
      isBillable: true,
    });
    async function loadCats() {
      try {
        const res = await fetch("/api/timer/categories");
        if (res.ok) {
          const data = await res.json();
          setCategories(data.categories || []);
        }
      } catch {
        // ignore
      }
    }
    loadCats();
  }, [open, today, reset]);

  const fuse = new Fuse(categories, {
    keys: ["category"],
    threshold: 0.4,
  });

  const filteredCats = catSearch
    ? fuse.search(catSearch).map((r) => r.item)
    : categories;

  const doSubmit = handleSubmit((data) => {
    onSubmit(data);
    onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Time Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={doSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="me-date">Date</Label>
              <Input id="me-date" type="date" {...register("date")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="me-start">Start</Label>
              <Input id="me-start" type="time" {...register("startTime")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="me-end">End</Label>
              <Input id="me-end" type="time" {...register("endTime")} />
            </div>
          </div>

          {/* Category with autocomplete */}
          <div className="space-y-1">
            <Label htmlFor="me-category">Category</Label>
            <div className="relative">
              <Input
                id="me-category"
                value={catSearch || categoryValue}
                onChange={(e) => {
                  setCatSearch(e.target.value);
                  setValue("category", e.target.value);
                  setCatDropdownOpen(true);
                }}
                onFocus={() => setCatDropdownOpen(true)}
                onBlur={() => setTimeout(() => setCatDropdownOpen(false), 200)}
                autoComplete="off"
              />
              {catDropdownOpen && filteredCats.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[150px] overflow-auto rounded-md border bg-popover shadow-md">
                  {filteredCats.map((cat) => (
                    <button
                      key={cat.category}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-accent"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setValue("category", cat.category);
                        setCatSearch("");
                        setCatDropdownOpen(false);
                      }}
                    >
                      <span
                        className={cn(
                          "h-2 w-2 rounded-full",
                          getCategoryColor(cat.category),
                        )}
                      />
                      {cat.category}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="me-desc">Description</Label>
            <Input
              id="me-desc"
              placeholder="What did you work on?"
              {...register("description")}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="me-billable"
              defaultChecked={true}
              onCheckedChange={(checked) =>
                setValue("isBillable", checked === true)
              }
            />
            <Label htmlFor="me-billable" className="text-sm font-normal">
              Billable
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Entry</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

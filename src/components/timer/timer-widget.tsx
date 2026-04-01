"use client";

import { useState } from "react";
import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTimer } from "./timer-provider";
import { TimerDisplay } from "./timer-display";
import { CategorySelector, getCategoryColor } from "./category-selector";

export function TimerWidget() {
  const {
    isRunning,
    currentCategory,
    todayTotalMinutes,
    startTimer,
    stopTimer,
  } = useTimer();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  const displayCategory = isRunning
    ? currentCategory
    : pendingCategory || currentCategory;

  const todayHours = Math.floor(todayTotalMinutes / 60);
  const todayMins = todayTotalMinutes % 60;

  function handleStartStop() {
    if (isRunning) {
      stopTimer();
    } else {
      const cat = pendingCategory || currentCategory || "General";
      startTimer(cat);
      setPendingCategory(null);
    }
  }

  function handleCategorySelect(cat: string) {
    if (isRunning) {
      // Stop current, start new category
      stopTimer().then(() => startTimer(cat));
    } else {
      setPendingCategory(cat);
    }
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 right-4 z-50 w-[280px] rounded-xl border bg-card shadow-lg transition-all",
        categoryOpen ? "h-auto" : "h-16",
      )}
    >
      {/* Category selector dropdown (opens above widget) */}
      <div className="relative">
        <CategorySelector
          value={displayCategory}
          onSelect={handleCategorySelect}
          open={categoryOpen}
          onOpenChange={setCategoryOpen}
        />
      </div>

      {/* Main widget bar */}
      <div className="flex h-16 items-center gap-2 px-3">
        {/* Start/Stop button */}
        <button
          onClick={handleStartStop}
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            isRunning
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-green-500 hover:bg-green-600 text-white",
          )}
          aria-label={isRunning ? "Stop timer" : "Start timer"}
        >
          {isRunning ? (
            <Square className="h-3.5 w-3.5 fill-current" />
          ) : (
            <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
          )}
        </button>

        {/* Timer + category */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <TimerDisplay size="sm" />
            {/* Category pill */}
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="flex max-w-[120px] items-center gap-1 truncate rounded-full border px-2 py-0.5 text-xs hover:bg-accent"
            >
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  displayCategory
                    ? getCategoryColor(displayCategory)
                    : "bg-gray-400",
                )}
              />
              <span className="truncate">{displayCategory || "Category"}</span>
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground">
            Today: {todayHours}h {todayMins}m
          </span>
        </div>
      </div>
    </div>
  );
}

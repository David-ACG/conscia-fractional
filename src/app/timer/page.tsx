"use client";

import { useState } from "react";
import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimerProvider, useTimer } from "@/components/timer/timer-provider";
import { TimerDisplay } from "@/components/timer/timer-display";
import {
  CategorySelector,
  getCategoryColor,
} from "@/components/timer/category-selector";

function TimerPopoutContent() {
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
      stopTimer().then(() => startTimer(cat));
    } else {
      setPendingCategory(cat);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-[280px] space-y-3">
        {/* Timer display */}
        <div className="text-center">
          <TimerDisplay size="lg" className="flex justify-center" />
        </div>

        {/* Category + controls */}
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleStartStop}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full transition-colors",
              isRunning
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-green-500 hover:bg-green-600 text-white",
            )}
            aria-label={isRunning ? "Stop timer" : "Start timer"}
          >
            {isRunning ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 fill-current ml-0.5" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm hover:bg-accent"
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  displayCategory
                    ? getCategoryColor(displayCategory)
                    : "bg-gray-400",
                )}
              />
              <span className="max-w-[140px] truncate">
                {displayCategory || "Category"}
              </span>
            </button>
            <CategorySelector
              value={displayCategory}
              onSelect={handleCategorySelect}
              open={categoryOpen}
              onOpenChange={setCategoryOpen}
              className="bottom-full left-0 w-[200px]"
            />
          </div>
        </div>

        {/* Today total */}
        <p className="text-center text-xs text-muted-foreground">
          Today: {todayHours}h {todayMins}m
        </p>
      </div>
    </div>
  );
}

export default function TimerPage() {
  return (
    <TimerProvider>
      <TimerPopoutContent />
    </TimerProvider>
  );
}

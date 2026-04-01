"use client";

import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/components/timer/category-selector";
import type { TimeEntry } from "@/lib/types";

interface WeeklySummaryProps {
  entries: TimeEntry[];
  weekStart: Date;
  contractHoursPerWeek: number;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WeeklySummary({
  entries,
  weekStart,
  contractHoursPerWeek,
}: WeeklySummaryProps) {
  // Group entries by day of week (0=Mon, 6=Sun)
  const dailyMinutes = new Array(7).fill(0);
  const categoryTotals = new Map<string, number>();

  for (const entry of entries) {
    const date = new Date(entry.started_at);
    const dayOfWeek = (date.getDay() + 6) % 7; // Convert Sun=0 to Mon=0
    dailyMinutes[dayOfWeek] += entry.duration_minutes || 0;

    const cat = entry.category || "General";
    categoryTotals.set(
      cat,
      (categoryTotals.get(cat) || 0) + (entry.duration_minutes || 0),
    );
  }

  const totalMinutes = dailyMinutes.reduce((a, b) => a + b, 0);
  const totalHours = totalMinutes / 60;
  const maxDailyMinutes = Math.max(...dailyMinutes, 1);
  const contractMinutes = contractHoursPerWeek * 60;

  // Sort categories by total time desc
  const sortedCategories = Array.from(categoryTotals.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  return (
    <div className="space-y-6">
      {/* Daily bar chart */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Hours per Day</h3>
        <div className="flex items-end gap-2">
          {DAY_LABELS.map((label, i) => {
            const mins = dailyMinutes[i];
            const height = Math.max((mins / maxDailyMinutes) * 100, 4);
            const hours = (mins / 60).toFixed(1);
            return (
              <div
                key={label}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <span className="text-xs tabular-nums text-muted-foreground">
                  {mins > 0 ? `${hours}h` : ""}
                </span>
                <div
                  className={cn(
                    "w-full rounded-t transition-all",
                    mins > 0 ? "bg-primary" : "bg-muted",
                  )}
                  style={{ height: `${height}px`, minHeight: "4px" }}
                />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="mb-3 text-sm font-medium">Category Breakdown</h3>
        <div className="space-y-2">
          {sortedCategories.map(([cat, mins]) => {
            const pct = Math.round((mins / totalMinutes) * 100);
            const hours = (mins / 60).toFixed(1);
            return (
              <div key={cat} className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-2.5 w-2.5 shrink-0 rounded-full",
                    getCategoryColor(cat),
                  )}
                />
                <span className="flex-1 text-sm">{cat}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {hours}h ({pct}%)
                </span>
              </div>
            );
          })}
          {sortedCategories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No entries this week.
            </p>
          )}
        </div>
      </div>

      {/* Total vs contract */}
      <div className="rounded-lg border p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Weekly Total</span>
          <span className="text-sm font-bold tabular-nums">
            {totalHours.toFixed(1)}h / {contractHoursPerWeek}h
          </span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              totalMinutes > contractMinutes ? "bg-red-500" : "bg-primary",
            )}
            style={{
              width: `${Math.min((totalMinutes / contractMinutes) * 100, 100)}%`,
            }}
          />
        </div>
        {totalMinutes > contractMinutes && (
          <p className="mt-1 text-xs text-red-500">
            Over contract by{" "}
            {((totalMinutes - contractMinutes) / 60).toFixed(1)}h
          </p>
        )}
      </div>
    </div>
  );
}

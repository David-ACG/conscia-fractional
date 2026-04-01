"use client";

import { Clock, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TimeEntry } from "@/lib/types";

interface HoursCardProps {
  timeEntries: TimeEntry[];
  weeklyLimit: number;
  hourlyRate: number | null;
}

export function HoursCard({
  timeEntries,
  weeklyLimit,
  hourlyRate,
}: HoursCardProps) {
  const totalMinutes = timeEntries.reduce(
    (sum, entry) => sum + (entry.duration_minutes ?? 0),
    0,
  );
  const totalHours = totalMinutes / 60;
  const percentage = Math.min((totalHours / weeklyLimit) * 100, 100);

  // Top 3 categories by time
  const categoryMap = new Map<string, number>();
  for (const entry of timeEntries) {
    const current = categoryMap.get(entry.category) ?? 0;
    categoryMap.set(entry.category, current + (entry.duration_minutes ?? 0));
  }
  const topCategories = [...categoryMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const earned = hourlyRate ? totalHours * hourlyRate : null;

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
        <Clock className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {totalHours.toFixed(1)}h{" "}
          <span className="text-sm font-normal text-muted-foreground">
            / {weeklyLimit}h
          </span>
        </div>
        <Progress value={percentage} className="mt-3" />
        {topCategories.length > 0 && (
          <div className="mt-4 space-y-1">
            {topCategories.map(([category, minutes]) => (
              <div
                key={category}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{category}</span>
                <span className="font-medium">
                  {(minutes / 60).toFixed(1)}h
                </span>
              </div>
            ))}
          </div>
        )}
        {topCategories.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            No time logged this week
          </p>
        )}
        {earned !== null && (
          <div className="mt-4 flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="size-3" />
            <span>£{earned.toFixed(0)} earned this week</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

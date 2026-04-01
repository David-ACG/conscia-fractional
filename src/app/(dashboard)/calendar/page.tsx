"use client";

import dynamic from "next/dynamic";

const CalendarView = dynamic(
  () =>
    import("@/components/calendar/calendar-view").then((m) => m.CalendarView),
  {
    ssr: false,
    loading: () => (
      <div className="h-[600px] animate-pulse rounded-lg bg-muted" />
    ),
  },
);

export default function CalendarPage() {
  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
      <p className="mt-1 text-muted-foreground">Your upcoming events.</p>
      <div className="mt-6">
        <CalendarView />
      </div>
    </div>
  );
}

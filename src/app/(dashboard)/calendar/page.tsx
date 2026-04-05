"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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
  const [syncing, setSyncing] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Synced ${data.synced ?? 0} events`);
        setSyncKey((k) => k + 1);
      } else {
        toast.error(data.error ?? "Sync failed");
      }
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendar</h1>
          <p className="mt-1 text-muted-foreground">Your upcoming events.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`}
          />
          {syncing ? "Syncing..." : "Sync Calendar"}
        </Button>
      </div>
      <div className="mt-6">
        <CalendarView key={syncKey} />
      </div>
    </div>
  );
}

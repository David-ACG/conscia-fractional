"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimeEntryList } from "@/components/timesheet/time-entry-list";
import { ManualEntryForm } from "@/components/timesheet/manual-entry-form";
import { WeeklySummary } from "@/components/timesheet/weekly-summary";
import { useClient } from "@/lib/client-context";
import type { TimeEntry, CrmCustomer } from "@/lib/types";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeekLabel(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  const endStr = weekEnd.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

function formatMonthLabel(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

export default function TimesheetPage() {
  const { clientId } = useClient();
  const [tab, setTab] = useState("monthly");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [monthEntries, setMonthEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [customers, setCustomers] = useState<
    Pick<CrmCustomer, "id" | "name">[]
  >([]);

  const weekStart = getWeekStart(selectedDate);
  const monthStart = getMonthStart(selectedDate);
  const monthEnd = getMonthEnd(selectedDate);

  const clientIdRef = useRef(clientId);
  clientIdRef.current = clientId;

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/crm-customers?clientId=${clientId}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCustomers(data))
      .catch(() => {});
  }, [clientId]);

  async function fetchEntries(from: string, to: string): Promise<TimeEntry[]> {
    const cid = clientIdRef.current;
    if (!cid) return [];
    const params = new URLSearchParams({ clientId: cid, from, to });
    const res = await fetch(`/api/timesheet?${params}`);
    if (!res.ok) return [];
    return (await res.json()) as TimeEntry[];
  }

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      if (tab === "daily") {
        const dayStart = new Date(selectedDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(selectedDate);
        dayEnd.setHours(23, 59, 59, 999);
        const data = await fetchEntries(
          dayStart.toISOString(),
          dayEnd.toISOString(),
        );
        if (!cancelled) setEntries(data);
      } else if (tab === "weekly") {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const data = await fetchEntries(
          weekStart.toISOString(),
          weekEnd.toISOString(),
        );
        if (!cancelled) setWeekEntries(data);
      } else {
        const data = await fetchEntries(
          monthStart.toISOString(),
          monthEnd.toISOString(),
        );
        if (!cancelled) setMonthEntries(data);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, selectedDate.toISOString(), clientId, refreshKey]);

  function navigateDate(delta: number) {
    setSelectedDate((prev) => {
      const next = new Date(prev);
      if (tab === "daily") {
        next.setDate(next.getDate() + delta);
      } else if (tab === "weekly") {
        next.setDate(next.getDate() + delta * 7);
      } else {
        next.setMonth(next.getMonth() + delta);
      }
      return next;
    });
  }

  function goToToday() {
    setSelectedDate(new Date());
  }

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleUpdate(id: string, updates: Partial<TimeEntry>) {
    const res = await fetch("/api/timesheet", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...updates }),
    });
    if (!res.ok) {
      toast.error("Failed to update entry");
      return;
    }
    toast.success("Entry updated");
    refresh();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/timesheet?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete entry");
      return;
    }
    toast.success("Entry deleted");
    refresh();
  }

  async function handleManualEntry(data: {
    date: string;
    startTime: string;
    endTime: string;
    category: string;
    description: string;
    isBillable: boolean;
    crm_customer_id?: string;
  }) {
    const startedAt = new Date(`${data.date}T${data.startTime}:00`);
    const stoppedAt = new Date(`${data.date}T${data.endTime}:00`);
    const durationMinutes = Math.round(
      (stoppedAt.getTime() - startedAt.getTime()) / 60000,
    );
    if (durationMinutes <= 0) {
      toast.error("End time must be after start time");
      return;
    }

    const res = await fetch("/api/timesheet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        category: data.category,
        description: data.description || null,
        started_at: startedAt.toISOString(),
        stopped_at: stoppedAt.toISOString(),
        duration_minutes: durationMinutes,
        is_manual: true,
        is_billable: data.isBillable,
        crm_customer_id: data.crm_customer_id || null,
      }),
    });
    if (!res.ok) {
      toast.error("Failed to save entry");
      return;
    }
    toast.success("Time entry added");
    refresh();
  }

  // Compute monthly totals
  const monthlyTotalMinutes = monthEntries.reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );
  const monthlyTotalHours = (monthlyTotalMinutes / 60).toFixed(1);

  // Generate month tabs: from engagement start (March 2026) through current month
  const monthTabs: { label: string; date: Date }[] = [];
  const engagementStart = new Date(2026, 2, 1); // March 2026
  const now = new Date();
  const endMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const cursor = new Date(engagementStart);
  while (cursor <= endMonth) {
    monthTabs.push({
      label: cursor.toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      }),
      date: new Date(cursor),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const dateLabel =
    tab === "daily"
      ? formatDateLabel(selectedDate)
      : tab === "weekly"
        ? formatWeekLabel(weekStart)
        : formatMonthLabel(selectedDate);

  return (
    <div className="animate-in space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
        <Button onClick={() => setManualFormOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Add Time
        </Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigateDate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant={isToday(selectedDate) ? "default" : "outline"}
              size="sm"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => navigateDate(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {tab !== "monthly" && (
          <p className="mt-1 text-sm text-muted-foreground">{dateLabel}</p>
        )}

        {tab === "monthly" && monthTabs.length > 1 && (
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {monthTabs.map((m) => {
              const isActive =
                selectedDate.getMonth() === m.date.getMonth() &&
                selectedDate.getFullYear() === m.date.getFullYear();
              return (
                <Button
                  key={m.label}
                  size="sm"
                  variant={isActive ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => setSelectedDate(new Date(m.date))}
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        )}

        <TabsContent value="daily">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            <TimeEntryList
              entries={entries}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          )}
        </TabsContent>

        <TabsContent value="weekly">
          <WeeklySummary
            entries={weekEntries}
            weekStart={weekStart}
            contractHoursPerWeek={16}
          />
          <div className="mt-4">
            <h3 className="mb-2 text-sm font-medium">All Entries This Week</h3>
            <TimeEntryList
              entries={weekEntries}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          </div>
        </TabsContent>

        <TabsContent value="monthly">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4 rounded-lg border p-4">
                <div>
                  <p className="text-2xl font-bold">{monthlyTotalHours}h</p>
                  <p className="text-sm text-muted-foreground">
                    Total for {formatMonthLabel(selectedDate)}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {monthEntries.length}{" "}
                  {monthEntries.length === 1 ? "entry" : "entries"}
                </div>
              </div>
              <div className="mt-4">
                <TimeEntryList
                  entries={monthEntries}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <ManualEntryForm
        open={manualFormOpen}
        onOpenChange={setManualFormOpen}
        onSubmit={handleManualEntry}
        defaultDate={selectedDate.toISOString().split("T")[0]}
        customers={customers}
      />
    </div>
  );
}

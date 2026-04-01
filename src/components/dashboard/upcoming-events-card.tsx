"use client";

import { useEffect, useState, useCallback } from "react";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { CalendarDays, ArrowRight, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface CrmCustomer {
  id: string;
  name: string;
  slug: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  crm_customer: CrmCustomer | null;
}

// Same palette/hash as calendar-view.tsx
const CUSTOMER_PALETTE = [
  "#4f46e5",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#6366f1",
];

function hashCustomerId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function getCustomerColor(customerId: string | null): string {
  if (!customerId) return "#6b7280";
  return CUSTOMER_PALETTE[hashCustomerId(customerId) % CUSTOMER_PALETTE.length];
}

function groupEvents(events: UpcomingEvent[]): {
  today: UpcomingEvent[];
  tomorrow: UpcomingEvent[];
  thisWeek: UpcomingEvent[];
} {
  const today: UpcomingEvent[] = [];
  const tomorrow: UpcomingEvent[] = [];
  const thisWeek: UpcomingEvent[] = [];

  for (const ev of events) {
    const start = parseISO(ev.start);
    if (isToday(start)) {
      today.push(ev);
    } else if (isTomorrow(start)) {
      tomorrow.push(ev);
    } else {
      thisWeek.push(ev);
    }
  }

  return { today, tomorrow, thisWeek };
}

function EventRow({ event }: { event: UpcomingEvent }) {
  const time = format(parseISO(event.start), "h:mm a");
  const color = getCustomerColor(event.crm_customer?.id ?? null);

  return (
    <Link
      href="/calendar"
      className="flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-accent transition-colors"
      data-testid="event-row"
    >
      <span className="text-xs text-muted-foreground w-16 shrink-0">
        {time}
      </span>
      <span className="flex-1 min-w-0 truncate font-medium">{event.title}</span>
      {event.crm_customer && (
        <span
          className="flex items-center gap-1 shrink-0 text-xs"
          style={{ color }}
          data-testid="customer-badge"
        >
          <span
            className="inline-block size-2 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="max-w-[80px] truncate">
            {event.crm_customer.name}
          </span>
        </span>
      )}
    </Link>
  );
}

function EventGroup({
  label,
  events,
}: {
  label: string;
  events: UpcomingEvent[];
}) {
  if (events.length === 0) return null;

  return (
    <div data-testid={`group-${label.toLowerCase().replace(" ", "-")}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      <div className="space-y-0.5">
        {events.map((ev) => (
          <EventRow key={ev.id} event={ev} />
        ))}
      </div>
    </div>
  );
}

export function UpcomingEventsCard() {
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasIntegration, setHasIntegration] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      const now = new Date();
      const end = new Date(now);
      end.setDate(end.getDate() + 7);

      const params = new URLSearchParams({
        start: now.toISOString(),
        end: end.toISOString(),
        limit: "5",
      });

      const res = await fetch(`/api/calendar/events?${params}`);
      if (res.status === 401) {
        setHasIntegration(false);
        setEvents([]);
        return;
      }
      if (!res.ok) throw new Error("fetch failed");

      const data: UpcomingEvent[] = await res.json();
      setEvents(data);
      setHasIntegration(true);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const { today, tomorrow, thisWeek } = groupEvents(events);
  const hasEvents = events.length > 0;

  return (
    <Card className="shadow-sm" data-testid="upcoming-events-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Upcoming Events</CardTitle>
        <CalendarDays className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : !hasIntegration ? (
          <div className="text-center py-2" data-testid="no-integration">
            <p className="text-sm text-muted-foreground mb-2">
              No upcoming events.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/integrations">
                <Wifi className="size-3.5 mr-1.5" />
                Connect Google Calendar
              </Link>
            </Button>
          </div>
        ) : !hasEvents ? (
          <div data-testid="empty-state">
            <p className="text-sm text-muted-foreground">No upcoming events.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <EventGroup label="Today" events={today} />
            <EventGroup label="Tomorrow" events={tomorrow} />
            <EventGroup label="This Week" events={thisWeek} />
          </div>
        )}

        {hasEvents && (
          <Link
            href="/calendar"
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="view-calendar-link"
          >
            View Calendar
            <ArrowRight className="size-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

import { useCallback, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventSourceFuncArg } from "@fullcalendar/core";
import { EventDetailDialog } from "./event-detail-dialog";
import type { CalendarEventForDialog } from "./event-detail-dialog";
import "./calendar.css";

interface ApiEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string | null;
  meeting_url?: string | null;
  attendees: Array<{ email: string; name?: string; responseStatus?: string }>;
  crm_customer: { id: string; name: string; slug: string } | null;
  meeting_id?: string | null;
  status: string;
  google_event_id?: string | null;
}

// 10 distinct colours for customer assignment
const CUSTOMER_PALETTE = [
  "#4f46e5", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
  "#6366f1", // indigo-light
];
const NO_CUSTOMER_COLOR = "#6b7280"; // gray-500

function hashCustomerId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

function getCustomerColor(customerId: string | null): string {
  if (!customerId) return NO_CUSTOMER_COLOR;
  return CUSTOMER_PALETTE[hashCustomerId(customerId) % CUSTOMER_PALETTE.length];
}

export function CalendarView() {
  const [selectedEvent, setSelectedEvent] =
    useState<CalendarEventForDialog | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const calendarRef = useRef<FullCalendar>(null);

  const fetchEvents = useCallback(
    async (
      fetchInfo: EventSourceFuncArg,
      successCallback: (events: object[]) => void,
      failureCallback: (error: Error) => void,
    ) => {
      try {
        const params = new URLSearchParams({
          start: fetchInfo.startStr,
          end: fetchInfo.endStr,
        });
        const res = await fetch(`/api/calendar/events?${params}`);
        if (!res.ok) throw new Error("Failed to fetch events");
        const data: ApiEvent[] = await res.json();

        successCallback(
          data.map((ev) => ({
            id: ev.id,
            title: ev.title,
            start: ev.start,
            end: ev.end,
            backgroundColor: getCustomerColor(ev.crm_customer?.id ?? null),
            borderColor: getCustomerColor(ev.crm_customer?.id ?? null),
            extendedProps: {
              location: ev.location,
              meeting_url: ev.meeting_url,
              attendees: ev.attendees,
              crm_customer: ev.crm_customer,
              meeting_id: ev.meeting_id,
              status: ev.status,
              google_event_id: ev.google_event_id,
            },
          })),
        );
      } catch (err) {
        failureCallback(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [],
  );

  const handleEventClick = useCallback((info: EventClickArg) => {
    const p = info.event.extendedProps;
    setSelectedEvent({
      id: info.event.id,
      title: info.event.title,
      start: info.event.startStr,
      end: info.event.endStr,
      location: p.location ?? null,
      meeting_url: p.meeting_url ?? null,
      attendees: p.attendees ?? [],
      crm_customer: p.crm_customer ?? null,
      meeting_id: p.meeting_id ?? null,
      status: p.status ?? "confirmed",
      google_event_id: p.google_event_id ?? null,
    });
    setDialogOpen(true);
  }, []);

  return (
    <>
      <div className="rounded-xl border bg-card p-4 shadow-sm fc-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridWeek,dayGridMonth",
          }}
          buttonText={{
            today: "Today",
            week: "Week",
            month: "Month",
          }}
          events={fetchEvents}
          eventClick={handleEventClick}
          height="auto"
          aspectRatio={1.8}
          nowIndicator
          allDaySlot
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          expandRows
          views={{
            timeGridWeek: {
              titleFormat: { month: "short", day: "numeric", year: "numeric" },
            },
          }}
        />
      </div>

      <EventDetailDialog
        event={selectedEvent}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  );
}

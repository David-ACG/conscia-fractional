"use client";

import { format, parseISO } from "date-fns";
import {
  MapPin,
  Video,
  Users,
  Building2,
  ExternalLink,
  Calendar,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";

export interface CalendarEventAttendee {
  email: string;
  name?: string;
  responseStatus?: "accepted" | "tentative" | "declined" | "needsAction";
}

export interface CalendarEventForDialog {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string | null;
  meeting_url?: string | null;
  attendees: CalendarEventAttendee[];
  crm_customer: { id: string; name: string; slug: string } | null;
  meeting_id?: string | null;
  status: string;
  google_event_id?: string | null;
}

interface EventDetailDialogProps {
  event: CalendarEventForDialog | null;
  open: boolean;
  onClose: () => void;
}

function detectMeetingPlatform(
  url: string,
): "meet" | "zoom" | "teams" | "other" {
  if (url.includes("meet.google.com")) return "meet";
  if (url.includes("zoom.us")) return "zoom";
  if (url.includes("teams.microsoft.com") || url.includes("teams.live.com"))
    return "teams";
  return "other";
}

function MeetingUrlLink({ url }: { url: string }) {
  const platform = detectMeetingPlatform(url);
  const labels: Record<string, string> = {
    meet: "Join Google Meet",
    zoom: "Join Zoom",
    teams: "Join Teams",
    other: "Join Meeting",
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
      data-testid="meeting-url-link"
      data-platform={platform}
    >
      <Video className="size-4 shrink-0" />
      {labels[platform]}
      <ExternalLink className="size-3" />
    </a>
  );
}

const responseStatusConfig = {
  accepted: {
    label: "Accepted",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
  tentative: {
    label: "Tentative",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  needsAction: {
    label: "Pending",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function EventDetailDialog({
  event,
  open,
  onClose,
}: EventDetailDialogProps) {
  if (!event) return null;

  const startDate = parseISO(event.start);
  const endDate = parseISO(event.end);

  const dateLabel = format(startDate, "EEE, MMMM d, yyyy");
  const startTime = format(startDate, "h:mm a");
  const endTime = format(endDate, "h:mm a");

  const googleCalendarUrl = event.google_event_id
    ? `https://calendar.google.com/calendar/event?eid=${btoa(event.google_event_id)}`
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg leading-snug pr-6">
            {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Date & time */}
          <div className="flex items-start gap-2 text-sm">
            <Calendar className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium">{dateLabel}</p>
              <p className="text-muted-foreground">
                {startTime} – {endTime}
              </p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="size-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Meeting URL */}
          {event.meeting_url && (
            <div className="flex items-start gap-2">
              <MeetingUrlLink url={event.meeting_url} />
            </div>
          )}

          {/* CRM Customer */}
          {event.crm_customer && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="size-4 shrink-0 text-muted-foreground" />
              <Link
                href={`/crm/${event.crm_customer.slug}`}
                className="font-medium text-primary hover:underline"
                data-testid="crm-customer-link"
              >
                {event.crm_customer.name}
              </Link>
            </div>
          )}

          {/* Attendees */}
          {event.attendees.length > 0 && (
            <>
              <Separator />
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    Attendees ({event.attendees.length})
                  </span>
                </div>
                <ul className="space-y-1.5" data-testid="attendees-list">
                  {event.attendees.map((attendee, i) => {
                    const status = attendee.responseStatus ?? "needsAction";
                    const config =
                      responseStatusConfig[
                        status as keyof typeof responseStatusConfig
                      ] ?? responseStatusConfig.needsAction;
                    return (
                      <li
                        key={attendee.email ?? i}
                        className="flex items-center justify-between text-sm"
                        data-testid={`attendee-${i}`}
                      >
                        <span className="text-sm">
                          {attendee.name || attendee.email}
                          {attendee.name && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({attendee.email})
                            </span>
                          )}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.className}`}
                          data-testid={`attendee-status-${status}`}
                        >
                          {config.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button asChild variant="outline" size="sm" className="flex-1">
            <Link
              href={`/meetings?from_event=${event.id}`}
              data-testid="create-meeting-btn"
            >
              Create Meeting Record
            </Link>
          </Button>
          <Button asChild variant="default" size="sm" className="flex-1">
            <Link
              href={`/meetings?record=true&from_event=${event.id}`}
              data-testid="record-meeting-btn"
            >
              Record Meeting
            </Link>
          </Button>
          {googleCalendarUrl && (
            <Button asChild variant="ghost" size="sm">
              <a
                href={googleCalendarUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="open-google-calendar-btn"
              >
                <ExternalLink className="size-3.5 mr-1" />
                Google Calendar
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Video,
  Monitor,
  Calendar,
  ExternalLink,
  CheckCircle,
  Download,
  FileText,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatDuration } from "@/lib/utils";
import type { Meeting, MeetingAttendee } from "@/lib/types";

type MeetingWithCustomer = Meeting & {
  crm_customer: { name: string } | null;
};

interface MeetingDetailProps {
  meeting: MeetingWithCustomer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isLogged: boolean;
  onLogToTimesheet: (meeting: MeetingWithCustomer) => void;
  loggingId: string | null;
  onEdit: (meeting: MeetingWithCustomer) => void;
}

const platformConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  zoom: {
    label: "Zoom",
    icon: Video,
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  teams: {
    label: "Teams",
    icon: Monitor,
    className:
      "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  },
  meet: {
    label: "Meet",
    icon: Video,
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

function formatDetailDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function handleDownloadPdf(meeting: MeetingWithCustomer) {
  // Build a printable HTML document and trigger browser print-to-PDF
  const date = meeting.meeting_date
    ? new Date(meeting.meeting_date).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";
  const attendees = (meeting.attendees || []) as MeetingAttendee[];
  const attendeeList = attendees
    .map((a) => `${a.name}${a.role ? ` (${a.role})` : ""}`)
    .join(", ");

  // Convert markdown summary to simple HTML
  const summaryHtml = (meeting.summary || "")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^\- \*\*(.+?)\*\*(.*)$/gm, "<li><strong>$1</strong>$2</li>")
    .replace(/^\- (.+)$/gm, "<li>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>");

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>${meeting.title} - Meeting Notes</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1a1a1a; line-height: 1.6; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  .meta { color: #666; margin-bottom: 24px; font-size: 14px; }
  h2 { font-size: 18px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  h3 { font-size: 15px; margin-top: 16px; margin-bottom: 4px; }
  li { margin-bottom: 4px; }
  ul { padding-left: 20px; }
  @media print { body { padding: 20px; } }
</style>
</head><body>
<h1>${meeting.title}</h1>
<div class="meta">
  ${date}${meeting.duration_minutes ? ` · ${meeting.duration_minutes} minutes` : ""}<br>
  ${attendeeList ? `Attendees: ${attendeeList}` : ""}
</div>
${summaryHtml}
</body></html>`;

  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
}

export function MeetingDetail({
  meeting,
  open,
  onOpenChange,
  isLogged,
  onLogToTimesheet,
  loggingId,
  onEdit,
}: MeetingDetailProps) {
  const [transcript, setTranscript] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);

  const meetingId = meeting?.id;
  /* eslint-disable react-hooks/set-state-in-effect -- intentional data fetching on dialog open */
  useEffect(() => {
    if (!open || !meetingId) {
      return;
    }
    let cancelled = false;
    setLoadingTranscript(true);
    fetch(`/api/meetings/${meetingId}/transcript-text`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setTranscript(d.transcript ?? null);
      })
      .catch(() => {
        if (!cancelled) setTranscript(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingTranscript(false);
      });

    return () => {
      cancelled = true;
      setTranscript(null);
    };
  }, [open, meetingId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!meeting) return null;

  const pConfig =
    meeting.platform && platformConfig[meeting.platform]
      ? platformConfig[meeting.platform]
      : {
          label: "Other",
          icon: Calendar,
          className:
            "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
        };
  const PlatformIcon = pConfig.icon;
  const attendees = (meeting.attendees || []) as MeetingAttendee[];
  const rawItems = (meeting.action_items || []) as Array<
    string | { title: string; description?: string }
  >;
  const actionItems = rawItems.map((item) =>
    typeof item === "string" ? item : item.title,
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="text-left">{meeting.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground">
              {formatDetailDate(meeting.meeting_date)}
            </span>
            {meeting.duration_minutes && (
              <>
                <span className="text-muted-foreground">·</span>
                <span>{formatDuration(meeting.duration_minutes)}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className={pConfig.className}>
              <PlatformIcon className="mr-1 h-3 w-3" />
              {pConfig.label}
            </Badge>
            {meeting.crm_customer?.name && (
              <Badge variant="outline">{meeting.crm_customer.name}</Badge>
            )}
          </div>

          <Separator />

          {/* Attendees */}
          {attendees.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Attendees</h4>
              <div className="space-y-1">
                {attendees.map((a, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-medium">{a.name}</span>
                    {a.role && (
                      <span className="text-muted-foreground"> — {a.role}</span>
                    )}
                    {a.email && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        {a.email}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Summary — rendered as markdown */}
          {meeting.summary && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Meeting Notes</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleDownloadPdf(meeting)}
                >
                  <FileText className="mr-1 h-3 w-3" />
                  Download PDF
                </Button>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1 [&_ul]:my-1 [&_li]:my-0.5 [&_p]:my-1 [&_strong]:font-semibold">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {meeting.summary}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Action Items */}
          {actionItems.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold mb-2">Action Items</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                {actionItems.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          {loadingTranscript && (
            <p className="text-sm text-muted-foreground">
              Loading transcript...
            </p>
          )}
          {transcript && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">Transcript</h4>
                <a
                  href={`/api/meetings/${meeting.id}/transcript-text`}
                  download
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Download className="h-3 w-3" />
                  Download .txt
                </a>
              </div>
              <div className="max-h-[300px] overflow-y-auto rounded-md border p-3 text-sm whitespace-pre-wrap text-muted-foreground">
                {transcript}
              </div>
            </div>
          )}

          {/* Recording */}
          {meeting.recording_url && (
            <div>
              <a
                href={meeting.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Recording
              </a>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            {isLogged ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle className="mr-1 h-3 w-3" />
                Logged to Timesheet
              </Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={loggingId === meeting.id}
                onClick={() => onLogToTimesheet(meeting)}
              >
                {loggingId === meeting.id ? "Logging..." : "Log to Timesheet"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onEdit(meeting);
              }}
            >
              Edit
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

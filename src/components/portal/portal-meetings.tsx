import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent } from "@/components/ui/card";
import { PortalEmptyState } from "./portal-empty-state";
import { Users, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import type { MeetingAttendee } from "@/lib/types";

interface PortalMeetingsProps {
  clientId: string;
}

export async function PortalMeetings({ clientId }: PortalMeetingsProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  // Explicitly exclude transcript field
  const { data: meetings } = await admin
    .from("meetings")
    .select(
      "id, title, meeting_date, duration_minutes, attendees, summary, action_items",
    )
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("meeting_date", { ascending: false });

  if (!meetings || meetings.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
        <PortalEmptyState
          icon={<Users className="size-10" />}
          title="No meetings shared yet"
          description="Meeting summaries will appear here once they are shared with you."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>

      <div className="space-y-4">
        {meetings.map((meeting) => {
          const attendees = (meeting.attendees ?? []) as MeetingAttendee[];
          const actionItems = (meeting.action_items ?? []) as string[];

          return (
            <details key={meeting.id} className="group">
              <summary className="cursor-pointer list-none">
                <Card className="transition-colors group-open:border-primary/30">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">
                          {meeting.title}
                        </h3>
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        {meeting.meeting_date && (
                          <span>
                            {format(
                              new Date(meeting.meeting_date),
                              "d MMM yyyy",
                            )}
                          </span>
                        )}
                        {meeting.duration_minutes && (
                          <span>{meeting.duration_minutes} min</span>
                        )}
                        {attendees.length > 0 && (
                          <span>
                            {attendees.length} attendee
                            {attendees.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </summary>

              <Card className="mt-2 border-l-4 border-l-primary/30">
                <CardContent className="space-y-4 py-4">
                  {meeting.summary ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown>{meeting.summary}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No summary available.
                    </p>
                  )}

                  {actionItems.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-sm font-semibold">
                        Action Items
                      </h4>
                      <ul className="space-y-1">
                        {actionItems.map((item, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-sm"
                          >
                            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </details>
          );
        })}
      </div>
    </div>
  );
}

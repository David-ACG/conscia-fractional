import Link from "next/link";
import { Calendar, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";

export async function MeetingsCard() {
  const clientId = await getActiveClientId();
  const supabase = createAdminClient();

  let meetings: Array<{
    id: string;
    title: string;
    meeting_date: string | null;
    duration_minutes: number | null;
    platform: string | null;
  }> = [];

  if (supabase && clientId) {
    const { data } = await supabase
      .from("meetings")
      .select("id, title, meeting_date, duration_minutes, platform")
      .eq("client_id", clientId)
      .order("meeting_date", { ascending: false })
      .limit(5);

    meetings = data ?? [];
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Meetings</CardTitle>
        <Calendar className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {meetings.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No meetings logged yet.
          </p>
        ) : (
          <div className="space-y-2">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <span className="line-clamp-1">{m.title}</span>
                  {m.meeting_date && (
                    <span className="text-xs text-muted-foreground block">
                      {new Date(m.meeting_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  )}
                </div>
                {m.duration_minutes && (
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {m.duration_minutes}min
                  </Badge>
                )}
              </div>
            ))}
            <Link href="/meetings">
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 h-7 text-xs w-full"
              >
                View all meetings
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

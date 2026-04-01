import { Activity, Clock, FileText, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatRelativeDate } from "@/lib/utils";
import type { TimeEntry, Note, Deliverable } from "@/lib/types";

type ActivityItem = {
  id: string;
  type: "time_entry" | "note" | "deliverable";
  description: string;
  timestamp: Date;
};

interface ActivityCardProps {
  timeEntries: TimeEntry[];
  notes: Note[];
  deliverables: Deliverable[];
}

function buildActivityFeed(
  timeEntries: TimeEntry[],
  notes: Note[],
  deliverables: Deliverable[],
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const entry of timeEntries) {
    items.push({
      id: entry.id,
      type: "time_entry",
      description: `Logged ${entry.duration_minutes ? (entry.duration_minutes / 60).toFixed(1) + "h" : "time"} — ${entry.category}`,
      timestamp: new Date(entry.created_at),
    });
  }

  for (const note of notes) {
    items.push({
      id: note.id,
      type: "note",
      description: `Added note: ${note.title}`,
      timestamp: new Date(note.created_at),
    });
  }

  for (const deliverable of deliverables) {
    items.push({
      id: deliverable.id,
      type: "deliverable",
      description: `${deliverable.status === "delivered" ? "Delivered" : "Updated"}: ${deliverable.name}`,
      timestamp: new Date(deliverable.created_at),
    });
  }

  return items
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 5);
}

const iconMap = {
  time_entry: Clock,
  note: FileText,
  deliverable: Package,
};

export function ActivityCard({
  timeEntries,
  notes,
  deliverables,
}: ActivityCardProps) {
  const feed = buildActivityFeed(timeEntries, notes, deliverables);

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        <Activity className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {feed.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No recent activity"
            description="Your recent time entries, notes, and deliverables will appear here."
          />
        ) : (
          <div className="space-y-3">
            {feed.map((item) => {
              const Icon = iconMap[item.type];
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-muted p-1.5">
                    <Icon className="size-3 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-sm leading-tight">{item.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeDate(item.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

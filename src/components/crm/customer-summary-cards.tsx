"use client";

import { Clock, CheckSquare, Users, FileOutput } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface CustomerSummaryCardsProps {
  summary: {
    hoursThisMonth: number;
    openTasks: number;
    meetingsCount: number;
    activeDeliverables: number;
  };
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

const cards = [
  {
    key: "hours" as const,
    label: "Hours This Month",
    icon: Clock,
    tab: "timesheet",
    format: (v: number) => formatDuration(v),
    field: "hoursThisMonth" as const,
  },
  {
    key: "tasks" as const,
    label: "Open Tasks",
    icon: CheckSquare,
    tab: "tasks",
    format: (v: number) => String(v),
    field: "openTasks" as const,
  },
  {
    key: "meetings" as const,
    label: "Meetings",
    icon: Users,
    tab: "meetings",
    format: (v: number) => String(v),
    field: "meetingsCount" as const,
  },
  {
    key: "deliverables" as const,
    label: "Deliverables",
    icon: FileOutput,
    tab: "deliverables",
    format: (v: number) => String(v),
    field: "activeDeliverables" as const,
  },
];

export function CustomerSummaryCards({ summary }: CustomerSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = summary[card.field];
        return (
          <Card key={card.key}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{card.format(value)}</p>
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

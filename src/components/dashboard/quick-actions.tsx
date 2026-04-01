import Link from "next/link";
import { Timer, StickyNote, ClockArrowUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const actions = [
  {
    label: "Start Timer",
    href: "/timer",
    icon: Timer,
  },
  {
    label: "Add Note",
    href: "/notes",
    icon: StickyNote,
  },
  {
    label: "Log Time",
    href: "/timesheet",
    icon: ClockArrowUp,
  },
] as const;

export function QuickActions() {
  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button key={action.href} variant="outline" size="sm" asChild>
              <Link href={action.href}>
                <action.icon className="mr-1.5 size-4" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

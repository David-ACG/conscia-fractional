import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalEmptyState } from "./portal-empty-state";
import { Clock } from "lucide-react";
import { format, startOfWeek, endOfWeek } from "date-fns";

interface PortalTimesheetProps {
  clientId: string;
}

export async function PortalTimesheet({ clientId }: PortalTimesheetProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();
  const monthEnd = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  ).toISOString();

  const { data: entries } = await admin
    .from("time_entries")
    .select(
      "id, category, description, started_at, duration_minutes, is_billable",
    )
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .gte("started_at", monthStart)
    .lte("started_at", monthEnd)
    .order("started_at", { ascending: false });

  if (!entries || entries.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
        <PortalEmptyState
          icon={<Clock className="size-10" />}
          title="No time entries shared yet"
          description="Time entries will appear here once they are shared with you."
        />
      </div>
    );
  }

  // Group by week
  const weeks = new Map<string, typeof entries>();
  for (const entry of entries) {
    const weekStart = startOfWeek(new Date(entry.started_at), {
      weekStartsOn: 1,
    });
    const key = weekStart.toISOString();
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(entry);
  }

  const monthTotal = entries.reduce(
    (sum, e) => sum + (e.duration_minutes ?? 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Timesheet</h1>
        <Badge variant="secondary" className="text-base">
          {format(now, "MMMM yyyy")}
        </Badge>
      </div>

      {Array.from(weeks.entries()).map(([weekKey, weekEntries]) => {
        const weekStart = new Date(weekKey);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekTotal = weekEntries.reduce(
          (sum, e) => sum + (e.duration_minutes ?? 0),
          0,
        );

        return (
          <Card key={weekKey}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Week of {format(weekStart, "d MMM")} –{" "}
                {format(weekEnd, "d MMM yyyy")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Billable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {weekEntries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(entry.started_at), "EEE d MMM")}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.description ?? "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatDuration(entry.duration_minutes ?? 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        {entry.is_billable ? (
                          <Badge variant="default" className="bg-green-600">
                            Yes
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-medium">
                      Week Total
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatDuration(weekTotal)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-lg font-semibold">Monthly Total</span>
          <span className="text-lg font-bold">
            {formatDuration(monthTotal)}
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

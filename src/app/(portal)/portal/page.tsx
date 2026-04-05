import { redirect } from "next/navigation";
import {
  Clock,
  CheckSquare,
  Users,
  Receipt,
  FileOutput,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  PortalSummaryCards,
  type SummaryCardData,
} from "@/components/portal/portal-summary-cards";
import {
  getPortalClientId,
  getPortalEnabledModules,
} from "@/lib/actions/portal-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDistanceToNow, format } from "date-fns";

export default async function PortalDashboardPage() {
  const clientId = await getPortalClientId();
  if (!clientId) redirect("/portal/login");

  const admin = createAdminClient();
  if (!admin) redirect("/portal/login");

  const enabledModules = await getPortalEnabledModules(clientId);

  // Fetch summary data in parallel — only for enabled modules
  const now = new Date();
  const monthStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    1,
  ).toISOString();

  const [hoursRes, tasksRes, meetingRes, invoiceRes] = await Promise.all([
    enabledModules.includes("timesheet")
      ? admin
          .from("time_entries")
          .select("duration_minutes")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .eq("is_billable", true)
          .gte("started_at", monthStart)
      : Promise.resolve({ data: null }),
    enabledModules.includes("tasks")
      ? admin
          .from("tasks")
          .select("id")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .neq("status", "done")
      : Promise.resolve({ data: null }),
    enabledModules.includes("meetings")
      ? admin
          .from("meetings")
          .select("meeting_date, title")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .gte("meeting_date", now.toISOString())
          .order("meeting_date", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: null }),
    enabledModules.includes("invoicing")
      ? admin
          .from("invoices")
          .select("total_amount_gbp")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .neq("status", "paid")
          .neq("status", "draft")
      : Promise.resolve({ data: null }),
  ]);

  // Build summary cards for enabled modules only
  const cards: SummaryCardData[] = [];

  if (hoursRes.data) {
    const totalMinutes = hoursRes.data.reduce(
      (sum, e) => sum + (e.duration_minutes ?? 0),
      0,
    );
    const hours = Math.round((totalMinutes / 60) * 10) / 10;
    cards.push({
      label: "Hours This Month",
      value: `${hours}h`,
      icon: Clock,
      href: "/portal/timesheet",
    });
  }

  if (tasksRes.data) {
    cards.push({
      label: "Open Tasks",
      value: tasksRes.data.length,
      icon: CheckSquare,
      href: "/portal/tasks",
    });
  }

  if (meetingRes.data) {
    const next = meetingRes.data[0];
    cards.push({
      label: "Next Meeting",
      value: next
        ? format(new Date(next.meeting_date), "d MMM")
        : "None scheduled",
      icon: CalendarDays,
      href: "/portal/meetings",
    });
  }

  if (invoiceRes.data) {
    const total = invoiceRes.data.reduce(
      (sum, inv) => sum + (inv.total_amount_gbp ?? 0),
      0,
    );
    cards.push({
      label: "Outstanding Balance",
      value: total > 0 ? `£${total.toLocaleString()}` : "£0",
      icon: Receipt,
      href: "/portal/invoicing",
    });
  }

  // Fetch recent activity across all enabled modules (10 items)
  type ActivityItem = {
    type: string;
    label: string;
    date: string;
    icon: string;
  };
  const activityPromises: Promise<ActivityItem[]>[] = [];

  if (enabledModules.includes("deliverables")) {
    activityPromises.push(
      (async () => {
        const { data } = await admin
          .from("deliverables")
          .select("name, created_at")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .order("created_at", { ascending: false })
          .limit(5);
        return (data ?? []).map(
          (d): ActivityItem => ({
            type: "deliverable",
            label: `Deliverable uploaded: ${d.name}`,
            date: d.created_at,
            icon: "deliverable",
          }),
        );
      })(),
    );
  }

  if (enabledModules.includes("meetings")) {
    activityPromises.push(
      (async () => {
        const { data } = await admin
          .from("meetings")
          .select("title, meeting_date")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .not("summary", "is", null)
          .order("meeting_date", { ascending: false })
          .limit(5);
        return (data ?? []).map(
          (m): ActivityItem => ({
            type: "meeting",
            label: `Meeting summary: ${m.title}`,
            date: m.meeting_date,
            icon: "meeting",
          }),
        );
      })(),
    );
  }

  if (enabledModules.includes("tasks")) {
    activityPromises.push(
      (async () => {
        const { data } = await admin
          .from("tasks")
          .select("title, updated_at")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .eq("status", "done")
          .order("updated_at", { ascending: false })
          .limit(5);
        return (data ?? []).map(
          (t): ActivityItem => ({
            type: "task",
            label: `Task completed: ${t.title}`,
            date: t.updated_at,
            icon: "task",
          }),
        );
      })(),
    );
  }

  if (enabledModules.includes("invoicing")) {
    activityPromises.push(
      (async () => {
        const { data } = await admin
          .from("invoices")
          .select("invoice_number, created_at")
          .eq("client_id", clientId)
          .eq("is_client_visible", true)
          .order("created_at", { ascending: false })
          .limit(5);
        return (data ?? []).map(
          (inv): ActivityItem => ({
            type: "invoice",
            label: `Invoice sent: INV-${inv.invoice_number ?? "???"}`,
            date: inv.created_at,
            icon: "invoice",
          }),
        );
      })(),
    );
  }

  const activityResults = await Promise.all(activityPromises);
  const allActivity = activityResults
    .flat()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const iconMap: Record<string, React.ReactNode> = {
    deliverable: <FileOutput className="size-4" />,
    meeting: <Users className="size-4" />,
    task: <CheckSquare className="size-4" />,
    invoice: <Receipt className="size-4" />,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Welcome to your Client Portal
        </h1>
        <p className="text-muted-foreground">
          View shared project information, track progress, and stay up to date.
        </p>
      </div>

      {cards.length > 0 && <PortalSummaryCards cards={cards} />}

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {allActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No recent activity to display.
            </p>
          ) : (
            <div className="space-y-3">
              {allActivity.map((item, i) => (
                <div
                  key={`${item.type}-${item.date}-${i}`}
                  className="flex items-center gap-3 text-sm"
                >
                  <div className="text-muted-foreground">
                    {iconMap[item.icon]}
                  </div>
                  <span className="flex-1">{item.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(item.date), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { startOfWeek, endOfWeek } from "date-fns";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  DashboardGrid,
  DashboardCard,
} from "@/components/dashboard/dashboard-grid";
import { HoursCard } from "@/components/dashboard/hours-card";
import { EngagementCard } from "@/components/dashboard/engagement-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { TasksCard } from "@/components/dashboard/tasks-card";
import { MeetingsCard } from "@/components/dashboard/meetings-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import { UpcomingEventsCard } from "@/components/dashboard/upcoming-events-card";
import type {
  TimeEntry,
  Engagement,
  Client,
  Note,
  Deliverable,
} from "@/lib/types";

async function getDashboardData() {
  const clientId = await getActiveClientId();
  const supabase = createClient();

  if (!supabase || !clientId) {
    return { timeEntries: [], engagement: null, notes: [], deliverables: [] };
  }

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString();
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 }).toISOString();

  const [timeEntriesRes, engagementRes, notesRes, deliverablesRes] =
    await Promise.all([
      supabase
        .from("time_entries")
        .select("*")
        .eq("client_id", clientId)
        .gte("started_at", weekStart)
        .lte("started_at", weekEnd)
        .order("started_at", { ascending: false }),
      supabase
        .from("engagements")
        .select("*, client:clients(*)")
        .eq("client_id", clientId)
        .eq("status", "active")
        .limit(1)
        .single(),
      supabase
        .from("notes")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("deliverables")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

  const engagement = engagementRes.data
    ? {
        ...(engagementRes.data as unknown as Engagement & { client: Client }),
      }
    : null;

  return {
    timeEntries: (timeEntriesRes.data ?? []) as TimeEntry[],
    engagement,
    notes: (notesRes.data ?? []) as Note[],
    deliverables: (deliverablesRes.data ?? []) as Deliverable[],
  };
}

export default async function DashboardPage() {
  const { timeEntries, engagement, notes, deliverables } =
    await getDashboardData();

  const weeklyLimit = engagement?.hours_per_week ?? 16;
  const hourlyRate = engagement?.hourly_rate_gbp ?? null;

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Your week at a glance.</p>

      <div className="mt-6">
        <DashboardGrid>
          <DashboardCard>
            <HoursCard
              timeEntries={timeEntries}
              weeklyLimit={weeklyLimit}
              hourlyRate={hourlyRate}
            />
          </DashboardCard>
          <DashboardCard>
            <EngagementCard engagement={engagement} />
          </DashboardCard>
          <DashboardCard>
            <QuickActions />
          </DashboardCard>
          <DashboardCard>
            <TasksCard />
          </DashboardCard>
          <DashboardCard>
            <MeetingsCard />
          </DashboardCard>
          <DashboardCard>
            <ActivityCard
              timeEntries={timeEntries}
              notes={notes}
              deliverables={deliverables}
            />
          </DashboardCard>
          <DashboardCard>
            <UpcomingEventsCard />
          </DashboardCard>
        </DashboardGrid>
      </div>
    </div>
  );
}

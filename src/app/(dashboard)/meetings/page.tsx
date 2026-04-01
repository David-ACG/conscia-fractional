import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { MeetingList } from "@/components/meetings/meeting-list";
import type { Meeting, CrmCustomer } from "@/lib/types";

async function getMeetingsData() {
  const clientId = await getActiveClientId();
  if (!clientId)
    return {
      meetings: [],
      customers: [],
      timesheetMeetingIds: new Set<string>(),
    };

  const supabase = createClient();
  if (!supabase)
    return {
      meetings: [],
      customers: [],
      timesheetMeetingIds: new Set<string>(),
    };

  const [meetingsRes, customersRes, timesheetRes, tasksRes] = await Promise.all(
    [
      supabase
        .from("meetings")
        .select("*, crm_customer:crm_customers(name)")
        .eq("client_id", clientId)
        .order("meeting_date", { ascending: false }),
      supabase
        .from("crm_customers")
        .select("id, name")
        .eq("client_id", clientId)
        .order("name"),
      supabase
        .from("time_entries")
        .select("meeting_id")
        .eq("client_id", clientId)
        .not("meeting_id", "is", null),
      supabase
        .from("tasks")
        .select("meeting_id")
        .eq("client_id", clientId)
        .not("meeting_id", "is", null),
    ],
  );

  const timesheetMeetingIds = new Set(
    (timesheetRes.data ?? []).map((t: { meeting_id: string }) => t.meeting_id),
  );

  // Count tasks per meeting
  const meetingTaskCounts: Record<string, number> = {};
  for (const t of tasksRes.data ?? []) {
    const mid = (t as { meeting_id: string }).meeting_id;
    meetingTaskCounts[mid] = (meetingTaskCounts[mid] ?? 0) + 1;
  }

  return {
    meetings: (meetingsRes.data ?? []) as (Meeting & {
      crm_customer: { name: string } | null;
    })[],
    customers: (customersRes.data ?? []) as Pick<CrmCustomer, "id" | "name">[],
    timesheetMeetingIds,
    meetingTaskCounts,
  };
}

export default async function MeetingsPage() {
  const { meetings, customers, timesheetMeetingIds, meetingTaskCounts } =
    await getMeetingsData();

  // Convert Set to array for serialization, reconstruct in client
  const timesheetIds = Array.from(timesheetMeetingIds);

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Meetings</h1>
      <p className="mt-2 text-muted-foreground">
        Log meetings, notes, and transcripts.
      </p>
      <div className="mt-6">
        <MeetingList
          meetings={meetings}
          customers={customers}
          timesheetMeetingIds={new Set(timesheetIds)}
          meetingTaskCounts={meetingTaskCounts}
        />
      </div>
    </div>
  );
}

import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { getEventForPreFill } from "@/lib/services/calendar-meeting-service";
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
        .select(
          "id, title, meeting_date, duration_minutes, actual_duration_seconds, platform, original_filename, attendees, action_items, recording_url, crm_customer_id, is_client_visible, summary, crm_customer:crm_customers(id, name, slug)",
        )
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

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ from_event?: string; record?: string }>;
}) {
  const { meetings, customers, timesheetMeetingIds, meetingTaskCounts } =
    await getMeetingsData();

  const params = await searchParams;
  const fromEventId = params.from_event;
  const recordMode = params.record === "true";

  // Pre-fill data from the calendar event (if navigated from calendar)
  const prefillData = fromEventId
    ? await getEventForPreFill(fromEventId)
    : null;

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
          prefillData={prefillData}
          recordMode={recordMode}
        />
      </div>
    </div>
  );
}

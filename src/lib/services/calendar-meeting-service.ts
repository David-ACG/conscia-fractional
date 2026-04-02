import { createAdminClient } from "@/lib/supabase/admin";
import type { MeetingPreFillData } from "@/lib/types";

function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

/**
 * Update calendar_events.meeting_id to link a completed meeting back to
 * the calendar event it was recorded from.
 */
export async function linkMeetingToEvent(
  meetingId: string,
  eventId: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase
    .from("calendar_events")
    .update({
      meeting_id: meetingId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
}

/**
 * Fetch a calendar event and build a structured MeetingPreFillData object
 * ready to pre-populate the meeting creation form or recording UI.
 *
 * - Duration is calculated from (end_time - start_time) and rounded up to
 *   the nearest 15 minutes.
 * - Attendees are matched against the contacts table where possible.
 */
export async function getEventForPreFill(
  eventId: string,
): Promise<MeetingPreFillData | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data: event } = await supabase
    .from("calendar_events")
    .select(
      "id, title, start_time, end_time, attendees, crm_customer_id, meeting_url",
    )
    .eq("id", eventId)
    .single();

  if (!event) return null;

  // Calculate duration in minutes, rounded up to nearest 15
  const startMs = new Date(event.start_time as string).getTime();
  const endMs = new Date(event.end_time as string).getTime();
  const rawMinutes = Math.max(1, Math.ceil((endMs - startMs) / 60_000));
  const duration = roundUpTo15(rawMinutes);

  // Match attendee emails against contacts
  const attendees = (event.attendees ?? []) as {
    email: string;
    name: string | null;
  }[];

  const emails = attendees.map((a) => a.email.toLowerCase()).filter(Boolean);

  const contactMap = new Map<string, string>(); // email → contact_id

  if (emails.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, email")
      .in("email", emails);

    for (const c of contacts ?? []) {
      if (c.email)
        contactMap.set((c.email as string).toLowerCase(), c.id as string);
    }
  }

  const participants = attendees.map((a) => ({
    contact_id: contactMap.get(a.email.toLowerCase()),
    email: a.email,
    name: a.name ?? a.email,
  }));

  return {
    title: event.title as string,
    date: event.start_time as string,
    duration,
    crm_customer_id: (event.crm_customer_id as string | null) ?? null,
    participants,
    meeting_url: (event.meeting_url as string | null) ?? null,
    source_event_id: eventId,
  };
}

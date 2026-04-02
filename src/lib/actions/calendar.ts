"use server";

import { linkMeetingToEvent } from "@/lib/services/calendar-meeting-service";

/**
 * Server action: link a newly-created or recorded meeting back to the
 * calendar event it originated from.
 *
 * Called from the client (RecordingContainer, MeetingForm) after a
 * meeting is successfully saved.
 */
export async function linkMeetingToEventAction(
  meetingId: string,
  eventId: string,
): Promise<void> {
  await linkMeetingToEvent(meetingId, eventId);
}

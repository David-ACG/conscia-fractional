import { google } from "googleapis";
import type { calendar_v3 } from "googleapis";
import { createAdminClient } from "@/lib/supabase/admin";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface CalendarEventAttendee {
  email: string;
  name: string | null;
  responseStatus: string;
}

export interface CalendarEvent {
  google_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  meeting_url: string | null;
  attendees: CalendarEventAttendee[];
  status: "confirmed" | "tentative" | "cancelled";
  raw_data: calendar_v3.Schema$Event;
}

export async function syncEvents(
  auth: OAuth2Client,
  syncToken?: string,
): Promise<{ events: CalendarEvent[]; nextSyncToken: string }> {
  const calendar = google.calendar({ version: "v3", auth });

  try {
    return await fetchAllEvents(calendar, syncToken);
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response
      ?.status;
    if (status === 410 && syncToken) {
      // Stale sync token — fall back to full re-sync
      return fetchAllEvents(calendar, undefined);
    }
    throw err;
  }
}

async function fetchAllEvents(
  calendar: calendar_v3.Calendar,
  syncToken?: string,
): Promise<{ events: CalendarEvent[]; nextSyncToken: string }> {
  const allEvents: CalendarEvent[] = [];
  let pageToken: string | undefined;
  let nextSyncToken = "";

  const now = new Date();
  const timeMin = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const timeMax = new Date(
    now.getTime() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString();

  do {
    const params: calendar_v3.Params$Resource$Events$List = {
      calendarId: "primary",
      singleEvents: true,
      pageToken,
    };

    if (syncToken) {
      params.syncToken = syncToken;
    } else {
      params.timeMin = timeMin;
      params.timeMax = timeMax;
    }

    const { data } = await calendar.events.list(params);

    for (const event of data.items ?? []) {
      const mapped = mapGoogleEvent(event);
      if (mapped) allEvents.push(mapped);
    }

    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken && data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken;
    }
  } while (pageToken);

  return { events: allEvents, nextSyncToken };
}

function mapGoogleEvent(event: calendar_v3.Schema$Event): CalendarEvent | null {
  const id = event.id;
  if (!id) return null;

  const startTime = event.start?.dateTime ?? event.start?.date;
  const endTime = event.end?.dateTime ?? event.end?.date;
  if (!startTime || !endTime) return null;

  const attendees = (event.attendees ?? [])
    .filter((a) => a.email)
    .map((a) => ({
      email: a.email!,
      name: a.displayName ?? null,
      responseStatus: a.responseStatus ?? "needsAction",
    }));

  const status = (event.status ?? "confirmed") as
    | "confirmed"
    | "tentative"
    | "cancelled";

  return {
    google_event_id: id,
    title: event.summary ?? "(No title)",
    description: event.description ?? null,
    start_time: new Date(startTime).toISOString(),
    end_time: new Date(endTime).toISOString(),
    location: event.location ?? null,
    meeting_url: extractMeetingUrl(event),
    attendees,
    status,
    raw_data: event,
  };
}

const MEETING_URL_PATTERNS = [
  /https?:\/\/[^\s"<>]*zoom\.us\/j\/\d+[^\s"<>]*/i,
  /https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s"<>]*/i,
  /https?:\/\/[^\s"<>]*webex\.com\/[^\s"<>]*/i,
];

export function extractMeetingUrl(
  event: calendar_v3.Schema$Event,
): string | null {
  if (event.hangoutLink) return event.hangoutLink;

  const searchText = [event.description ?? "", event.location ?? ""].join(" ");

  for (const pattern of MEETING_URL_PATTERNS) {
    const match = searchText.match(pattern);
    if (match) return match[0];
  }

  return null;
}

export async function matchAttendeesToCustomer(
  attendees: { email: string }[],
  userId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // Exclude the user's own Google account emails from matching
  const { data: userIntegrations } = await supabase
    .from("integrations")
    .select("account_identifier")
    .eq("user_id", userId)
    .eq("provider", "google")
    .eq("is_active", true);

  const userEmails = new Set(
    (userIntegrations ?? [])
      .map((i: { account_identifier: string | null }) =>
        i.account_identifier?.toLowerCase(),
      )
      .filter(Boolean),
  );

  const attendeeEmails = attendees
    .map((a) => a.email.toLowerCase())
    .filter((email) => !userEmails.has(email));

  if (attendeeEmails.length === 0) return null;

  // Find contacts matching attendee emails → get their client_ids
  const { data: contacts } = await supabase
    .from("contacts")
    .select("client_id")
    .in("email", attendeeEmails)
    .not("client_id", "is", null);

  if (!contacts || contacts.length === 0) return null;

  const clientIds = [
    ...new Set(contacts.map((c: { client_id: string }) => c.client_id)),
  ];

  // Return crm_customer_id from the most recent meeting for these clients
  const { data: meetings } = await supabase
    .from("meetings")
    .select("crm_customer_id")
    .in("client_id", clientIds)
    .not("crm_customer_id", "is", null)
    .order("meeting_date", { ascending: false })
    .limit(1);

  if (meetings && meetings.length > 0) {
    return meetings[0].crm_customer_id as string;
  }

  // Fallback: return first crm_customer for these clients
  const { data: customers } = await supabase
    .from("crm_customers")
    .select("id")
    .in("client_id", clientIds)
    .limit(1);

  return customers?.[0]?.id ?? null;
}

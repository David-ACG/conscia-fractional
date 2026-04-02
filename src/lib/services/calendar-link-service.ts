import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Link a calendar event to a CRM customer by matching attendee emails
 * against the contacts table. Resolves ambiguity when multiple customers
 * match by choosing the one with the most recent meeting.
 *
 * Returns the resolved crm_customer_id, or null if no match.
 */
export async function linkEventToCustomer(
  eventId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  // 1. Fetch the calendar event
  const { data: event } = await supabase
    .from("calendar_events")
    .select("id, user_id, attendees")
    .eq("id", eventId)
    .single();

  if (!event) return null;

  const attendees = (event.attendees ?? []) as { email: string }[];
  if (attendees.length === 0) return null;

  // 2. Get the user's own Google account emails to exclude from matching
  const { data: userIntegrations } = await supabase
    .from("integrations")
    .select("account_identifier")
    .eq("user_id", event.user_id)
    .eq("provider", "google")
    .eq("is_active", true);

  const userEmails = new Set<string>(
    (userIntegrations ?? [])
      .map((i: { account_identifier: string | null }) =>
        i.account_identifier?.toLowerCase(),
      )
      .filter((e): e is string => Boolean(e)),
  );

  // 3. Filter out the user's own emails
  const attendeeEmails = attendees
    .map((a) => a.email.toLowerCase())
    .filter((email) => !userEmails.has(email));

  if (attendeeEmails.length === 0) return null;

  // 4. Find contacts matching attendee emails → collect crm_customer_ids
  const { data: contacts } = await supabase
    .from("contacts")
    .select("crm_customer_id")
    .in("email", attendeeEmails)
    .not("crm_customer_id", "is", null);

  if (!contacts || contacts.length === 0) return null;

  // 5. Deduplicate customer IDs
  const customerIds = [
    ...new Set(
      contacts.map((c: { crm_customer_id: string }) => c.crm_customer_id),
    ),
  ] as string[];

  let resolvedCustomerId: string;

  if (customerIds.length === 1) {
    // Single match — use it directly
    resolvedCustomerId = customerIds[0];
  } else {
    // Multiple customers — pick the one with the most recent meeting
    const { data: meetings } = await supabase
      .from("meetings")
      .select("crm_customer_id, meeting_date")
      .in("crm_customer_id", customerIds)
      .not("meeting_date", "is", null)
      .order("meeting_date", { ascending: false })
      .limit(1);

    if (meetings && meetings.length > 0) {
      resolvedCustomerId = meetings[0].crm_customer_id as string;
    } else {
      // No prior meetings for any matched customer — fall back to first match
      resolvedCustomerId = customerIds[0];
    }
  }

  // 6. Persist the link on the calendar event
  await supabase
    .from("calendar_events")
    .update({
      crm_customer_id: resolvedCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  return resolvedCustomerId;
}

/**
 * Link a batch of calendar events to CRM customers in parallel.
 * Uses Promise.allSettled so individual failures don't block the rest.
 */
export async function batchLinkEvents(eventIds: string[]): Promise<void> {
  if (eventIds.length === 0) return;

  const results = await Promise.allSettled(
    eventIds.map((id) => linkEventToCustomer(id)),
  );

  let linked = 0;
  let skipped = 0;
  let errors = 0;

  for (const result of results) {
    if (result.status === "fulfilled") {
      if (result.value !== null) linked++;
      else skipped++;
    } else {
      errors++;
      console.error("batchLinkEvents: failed for an event:", result.reason);
    }
  }

  console.log(
    `batchLinkEvents: linked=${linked} skipped=${skipped} errors=${errors}`,
  );
}

/**
 * Re-run linkEventToCustomer only when the attendee list has changed.
 * Compares email sets — if identical, skips the update.
 */
export async function relinkIfAttendeesChanged(
  eventId: string,
  previousAttendees: { email: string }[],
  newAttendees: { email: string }[],
): Promise<void> {
  const prevEmails = new Set(
    previousAttendees.map((a) => a.email.toLowerCase()),
  );
  const newEmailList = newAttendees.map((a) => a.email.toLowerCase());

  const changed =
    prevEmails.size !== newEmailList.length ||
    newEmailList.some((e) => !prevEmails.has(e));

  if (changed) {
    await linkEventToCustomer(eventId);
  }
}

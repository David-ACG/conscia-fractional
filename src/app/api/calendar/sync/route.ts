import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncEvents } from "@/lib/services/google-calendar-service";
import { batchLinkEvents } from "@/lib/services/calendar-link-service";
import {
  createOAuth2Client,
  getValidAccessToken,
} from "@/lib/services/google-auth-service";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function POST() {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: integrations } = await admin
    .from("integrations")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("is_active", true)
    .contains("scopes", [CALENDAR_SCOPE]);

  if (!integrations?.length) {
    return NextResponse.json(
      {
        error:
          "No Google Calendar integration found. Connect Calendar access in Settings.",
      },
      { status: 400 },
    );
  }

  let totalSynced = 0;

  for (const integration of integrations) {
    const accessToken = await getValidAccessToken(integration.id);
    const auth = createOAuth2Client();
    auth.setCredentials({ access_token: accessToken });

    const existingMeta =
      (integration.metadata as Record<string, unknown>) ?? {};
    const syncToken =
      (existingMeta.calendar_sync_token as string | undefined) ?? undefined;

    const { events, nextSyncToken } = await syncEvents(auth, syncToken);

    const linkBatch: string[] = [];

    for (const event of events) {
      const { data: upserted } = await admin
        .from("calendar_events")
        .upsert(
          {
            user_id: integration.user_id,
            integration_id: integration.id,
            google_event_id: event.google_event_id,
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location,
            meeting_url: event.meeting_url,
            attendees: event.attendees,
            status: event.status,
            raw_data: event.raw_data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "integration_id,google_event_id" },
        )
        .select("id");

      if (upserted?.[0]?.id) {
        linkBatch.push(upserted[0].id as string);
      }

      totalSynced++;
    }

    if (linkBatch.length > 0) {
      await batchLinkEvents(linkBatch);
    }

    await admin
      .from("integrations")
      .update({
        metadata: {
          ...existingMeta,
          calendar_sync_token: nextSyncToken,
          calendar_last_sync: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", integration.id);
  }

  return NextResponse.json({ synced: totalSynced });
}

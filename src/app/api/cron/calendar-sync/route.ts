// Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/calendar-sync
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  syncEvents,
  matchAttendeesToCustomer,
} from "@/lib/services/google-calendar-service";
import {
  createOAuth2Client,
  getValidAccessToken,
} from "@/lib/services/google-auth-service";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: integrations, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", "google")
    .eq("is_active", true)
    .contains("scopes", [CALENDAR_SCOPE]);

  if (intErr) {
    return NextResponse.json({ error: intErr.message }, { status: 500 });
  }

  let totalSynced = 0;
  const errors: string[] = [];

  for (const integration of integrations ?? []) {
    try {
      const accessToken = await getValidAccessToken(integration.id);
      const auth = createOAuth2Client();
      auth.setCredentials({ access_token: accessToken });

      const existingMeta =
        (integration.metadata as Record<string, unknown>) ?? {};
      const syncToken =
        (existingMeta.calendar_sync_token as string | undefined) ?? undefined;

      const { events, nextSyncToken } = await syncEvents(auth, syncToken);

      for (const event of events) {
        const crm_customer_id = await matchAttendeesToCustomer(
          event.attendees,
          integration.user_id,
        );

        await supabase.from("calendar_events").upsert(
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
            crm_customer_id,
            status: event.status,
            raw_data: event.raw_data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "integration_id,google_event_id" },
        );

        totalSynced++;
      }

      // Store sync token and last sync time in integration metadata
      await supabase
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
    } catch (err) {
      const message = `Integration ${integration.id}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      errors.push(message);
    }
  }

  return NextResponse.json({ synced: totalSynced, errors });
}

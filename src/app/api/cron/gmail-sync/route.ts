// Local dev: curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3002/api/cron/gmail-sync
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkNewEmails,
  GMAIL_SCOPES,
} from "@/lib/services/gmail-sync-service";

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

  // Fetch all active Google integrations with Gmail scopes
  const { data: integrations, error: intErr } = await supabase
    .from("integrations")
    .select("*")
    .eq("provider", "google")
    .eq("is_active", true)
    .or(GMAIL_SCOPES.map((scope) => `scopes.cs.{${scope}}`).join(","));

  if (intErr) {
    return NextResponse.json({ error: intErr.message }, { status: 500 });
  }

  let integrationsChecked = 0;
  let totalNewEmails = 0;
  let totalNotificationsCreated = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const integration of integrations ?? []) {
    integrationsChecked++;
    try {
      const newEmails = await checkNewEmails(integration.id);
      totalNewEmails += newEmails.length;

      for (const email of newEmails) {
        const { error: insertErr } = await supabase
          .from("notifications")
          .insert({
            user_id: integration.user_id,
            type: "new_email",
            title: `New email from ${email.from}`,
            body: `Subject: ${email.subject}`,
            source_url: `https://mail.google.com/mail/u/0/#inbox/${email.messageId}`,
            crm_customer_id: email.crmCustomerId,
            is_read: false,
          });

        if (insertErr) {
          errors.push(
            `Integration ${integration.id}: Failed to insert notification — ${insertErr.message}`,
          );
          errorCount++;
        } else {
          totalNotificationsCreated++;
        }
      }
    } catch (err) {
      const message = `Integration ${integration.id}: ${
        err instanceof Error ? err.message : String(err)
      }`;
      errors.push(message);
      errorCount++;
    }
  }

  return NextResponse.json({
    integrations_checked: integrationsChecked,
    new_emails: totalNewEmails,
    notifications_created: totalNotificationsCreated,
    errors,
  });
}

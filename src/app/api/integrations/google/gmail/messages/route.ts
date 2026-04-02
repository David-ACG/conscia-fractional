import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/services/google-auth-service";
import {
  getGmailClient,
  listMessagesForCustomer,
} from "@/lib/services/gmail-service";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const crmCustomerId = searchParams.get("crm_customer_id");
  const integrationId = searchParams.get("integration_id");
  const pageToken = searchParams.get("page_token") ?? undefined;

  if (!crmCustomerId || !integrationId) {
    return NextResponse.json(
      { error: "Missing required parameters: crm_customer_id, integration_id" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  // Verify integration belongs to user
  const { data: integration } = await admin
    .from("integrations")
    .select("id, scopes, user_id")
    .eq("id", integrationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  // Verify Gmail scope
  const scopes: string[] = integration.scopes ?? [];
  const hasGmailScope = GMAIL_SCOPES.some((s) => scopes.includes(s));
  if (!hasGmailScope) {
    return NextResponse.json(
      {
        error:
          "Gmail scope not authorized. Please add Gmail access in Settings.",
      },
      { status: 403 },
    );
  }

  // Look up contacts for this customer
  const { data: contacts } = await admin
    .from("contacts")
    .select("email")
    .eq("crm_customer_id", crmCustomerId)
    .not("email", "is", null);

  const contactEmails = (contacts ?? [])
    .filter((c) => c.email)
    .map((c) => ({ email: c.email as string }));

  if (contactEmails.length === 0) {
    return NextResponse.json({
      messages: [],
      contactEmails: [],
      nextPageToken: undefined,
    });
  }

  try {
    const accessToken = await getValidAccessToken(integrationId);
    const gmail = getGmailClient(accessToken);
    const result = await listMessagesForCustomer(
      gmail,
      contactEmails,
      20,
      pageToken,
    );

    return NextResponse.json({
      messages: result.messages,
      nextPageToken: result.nextPageToken,
      contactEmails: contactEmails.map((c) => c.email),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (
      message.includes("re-authorization") ||
      message.includes("refresh") ||
      message.includes("invalid_grant")
    ) {
      return NextResponse.json(
        {
          error:
            "Token expired. Please reconnect your Google account in Settings.",
        },
        { status: 401 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

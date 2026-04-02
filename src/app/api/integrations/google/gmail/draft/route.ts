import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/services/google-auth-service";
import {
  getGmailClient,
  hasSendAccess,
  createDraft,
} from "@/lib/services/gmail-service";

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { integration_id, to, subject, body: emailBody, thread_id } = body;

  if (!integration_id || !to || !subject) {
    return NextResponse.json(
      { error: "Missing required fields: integration_id, to, subject" },
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
    .eq("id", integration_id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  const scopes: string[] = integration.scopes ?? [];
  if (!hasSendAccess(scopes)) {
    return NextResponse.json(
      {
        error:
          "Gmail send scope not authorized. Add send access in Settings first.",
      },
      { status: 403 },
    );
  }

  try {
    const accessToken = await getValidAccessToken(integration_id);
    const gmail = getGmailClient(accessToken);

    const result = await createDraft(gmail, {
      to,
      subject,
      body: emailBody ?? "",
      threadId: thread_id,
    });

    return NextResponse.json({ draft_id: result.draftId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (
      message.includes("re-authorization") ||
      message.includes("invalid_grant")
    ) {
      return NextResponse.json(
        { error: "Token expired. Please reconnect your Google account." },
        { status: 401 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

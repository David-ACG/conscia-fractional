import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { WebClient } from "@slack/web-api";

// --- Signature verification ---

export function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string,
): boolean {
  const hmac = createHmac("sha256", signingSecret);
  hmac.update(`v0:${timestamp}:${body}`);
  const digest = `v0=${hmac.digest("hex")}`;

  const sigBuf = Buffer.from(signature, "ascii");
  const digestBuf = Buffer.from(digest, "ascii");

  if (sigBuf.length !== digestBuf.length) return false;

  return timingSafeEqual(sigBuf, digestBuf);
}

// --- POST handler ---

export async function POST(request: NextRequest) {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json(
      { error: "Slack signing secret not configured" },
      { status: 500 },
    );
  }

  // Read raw body once — needed for signature verification
  const rawBody = await request.text();

  const signature = request.headers.get("x-slack-signature") ?? "";
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";

  // Replay protection: reject requests older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 60 * 5) {
    return NextResponse.json(
      { error: "Request timestamp too old" },
      { status: 401 },
    );
  }

  if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // url_verification challenge (required when first configuring Events API URL)
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // Handle event callbacks — acknowledge immediately, process synchronously
  // (Slack requires 200 within 3 seconds; task creation is fast)
  if (body.type === "event_callback") {
    const event = body.event as Record<string, unknown> | undefined;
    const teamId = body.team_id as string | undefined;

    if (event?.type === "reaction_added" && teamId) {
      // Fire-and-forget style: we still need to respond quickly but we process inline
      // since DB lookups are fast. For heavy processing, use a queue.
      try {
        await handleReactionAdded(event, teamId);
      } catch (err) {
        // Log but don't fail — always return 200 to Slack
        console.error("Failed to process reaction_added event:", err);
      }
    }
  }

  // Always return 200 for all event types
  return NextResponse.json({ ok: true });
}

// --- reaction_added handler ---

async function handleReactionAdded(
  event: Record<string, unknown>,
  teamId: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;

  const reaction = event.reaction as string | undefined;
  const item = event.item as Record<string, unknown> | undefined;
  const channelId = item?.channel as string | undefined;
  const messageTs = item?.ts as string | undefined;

  if (!reaction || !channelId || !messageTs) return;

  // Look up integration by team_id
  const { data: integration } = await admin
    .from("integrations")
    .select("id, user_id, access_token_encrypted, metadata")
    .eq("provider", "slack")
    .eq("is_active", true)
    .filter("metadata->>team_id", "eq", teamId)
    .single();

  if (!integration) return;

  const metadata = integration.metadata as Record<string, unknown>;
  const configuredEmoji =
    (metadata?.task_reaction_emoji as string | undefined) ?? "white_check_mark";

  // Only act on the configured emoji
  if (reaction !== configuredEmoji) return;

  // Look up channel mapping
  const { data: mapping } = await admin
    .from("slack_channel_mappings")
    .select("crm_customer_id")
    .eq("integration_id", integration.id)
    .eq("channel_id", channelId)
    .single();

  if (!mapping?.crm_customer_id) return;

  if (!integration.access_token_encrypted) return;

  const botToken = decrypt(integration.access_token_encrypted);
  const client = new WebClient(botToken);

  // Fetch the original message
  const historyResponse = await client.conversations.history({
    channel: channelId,
    latest: messageTs,
    limit: 1,
    inclusive: true,
  });

  const message = historyResponse.messages?.[0];
  if (!message?.text) return;

  // Get permalink
  let permalink: string | undefined;
  try {
    const permalinkResponse = await client.chat.getPermalink({
      channel: channelId,
      message_ts: messageTs,
    });
    permalink = permalinkResponse.permalink ?? undefined;
  } catch {
    // Continue without permalink
  }

  const fullText = message.text;
  const title = fullText.slice(0, 100);
  const description = permalink
    ? `${fullText}\n\nSlack permalink: ${permalink}`
    : fullText;

  // Create the task
  await admin.from("tasks").insert({
    user_id: integration.user_id,
    crm_customer_id: mapping.crm_customer_id,
    title,
    description,
    source: "slack",
    status: "todo",
  });

  // Post confirmation to channel
  await client.chat.postMessage({
    channel: channelId,
    text: `Task created: ${title}`,
  });
}

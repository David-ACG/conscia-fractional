import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import {
  postMessage,
  formatMeetingSummary,
  formatTaskUpdate,
} from "@/lib/services/slack-service";

// ─── Internal helpers ────────────────────────────────────────────────

async function getSlackBotToken(): Promise<{
  integrationId: string;
  botToken: string;
  metadata: Record<string, unknown>;
} | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("integrations")
    .select("id, access_token_encrypted, metadata")
    .eq("provider", "slack")
    .eq("is_active", true)
    .limit(1)
    .single();

  if (error || !data || !data.access_token_encrypted) return null;

  try {
    const botToken = decrypt(data.access_token_encrypted);
    return {
      integrationId: data.id as string,
      botToken,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

async function getChannelForCustomer(
  integrationId: string,
  crmCustomerId: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("slack_channel_mappings")
    .select("channel_id")
    .eq("integration_id", integrationId)
    .eq("crm_customer_id", crmCustomerId)
    .limit(1)
    .single();

  if (error || !data) return null;
  return data.channel_id as string;
}

// ─── Public API ──────────────────────────────────────────────────────

export async function notifyMeetingProcessed(meetingId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: meeting, error } = await supabase
      .from("meetings")
      .select(
        "id, title, meeting_date, attendees, summary, action_items, crm_customer_id",
      )
      .eq("id", meetingId)
      .single();

    if (error || !meeting || !meeting.crm_customer_id) return;

    const slack = await getSlackBotToken();
    if (!slack) return;

    if (slack.metadata.notify_meeting_summaries === false) return;

    const channelId = await getChannelForCustomer(
      slack.integrationId,
      meeting.crm_customer_id as string,
    );
    if (!channelId) return;

    const attendees = (
      (meeting.attendees as Array<{ name?: string }> | null) ?? []
    )
      .map((a) => a.name ?? "")
      .filter(Boolean);

    // action_items may be jsonb array of strings or objects
    const rawItems = (meeting.action_items as unknown[]) ?? [];
    const actionItems = rawItems.map((item) => {
      if (typeof item === "string") return { title: item, assignee: null };
      const obj = item as Record<string, unknown>;
      return {
        title: String(obj.title ?? obj.text ?? item),
        assignee: (obj.assignee as string | null) ?? null,
      };
    });

    const { text, blocks } = formatMeetingSummary({
      title: meeting.title as string,
      date: (meeting.meeting_date as string) ?? new Date().toISOString(),
      participants: attendees,
      decisions: [],
      action_items: actionItems,
    });

    await postMessage(slack.botToken, channelId, text, blocks);
  } catch (error) {
    console.error("[slack-notification] notifyMeetingProcessed failed:", error);
  }
}

export async function notifyTaskCreated(taskId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: task, error } = await supabase
      .from("tasks")
      .select("id, title, assignee, crm_customer_id")
      .eq("id", taskId)
      .single();

    if (error || !task || !task.crm_customer_id) return;

    const slack = await getSlackBotToken();
    if (!slack) return;

    if (slack.metadata.notify_task_updates === false) return;

    const channelId = await getChannelForCustomer(
      slack.integrationId,
      task.crm_customer_id as string,
    );
    if (!channelId) return;

    const { text, blocks } = formatTaskUpdate(
      { title: task.title as string, assignee: task.assignee as string | null },
      "created",
    );

    await postMessage(slack.botToken, channelId, text, blocks);
  } catch (error) {
    console.error("[slack-notification] notifyTaskCreated failed:", error);
  }
}

export async function notifyTaskCompleted(taskId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    if (!supabase) return;

    const { data: task, error } = await supabase
      .from("tasks")
      .select("id, title, assignee, crm_customer_id")
      .eq("id", taskId)
      .single();

    if (error || !task || !task.crm_customer_id) return;

    const slack = await getSlackBotToken();
    if (!slack) return;

    if (slack.metadata.notify_task_updates === false) return;

    const channelId = await getChannelForCustomer(
      slack.integrationId,
      task.crm_customer_id as string,
    );
    if (!channelId) return;

    const { text, blocks } = formatTaskUpdate(
      { title: task.title as string, assignee: task.assignee as string | null },
      "completed",
    );

    await postMessage(slack.botToken, channelId, text, blocks);
  } catch (error) {
    console.error("[slack-notification] notifyTaskCompleted failed:", error);
  }
}

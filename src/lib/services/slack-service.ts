import { WebClient, type KnownBlock } from "@slack/web-api";

// --- Types ---

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export interface SlackMessage {
  ts: string;
  user: string;
  user_name?: string;
  text: string;
  permalink?: string;
}

// --- listChannels ---

export async function listChannels(botToken: string): Promise<SlackChannel[]> {
  const client = new WebClient(botToken);
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.conversations.list({
      types: "public_channel,private_channel",
      limit: 200,
      cursor,
    });

    if (!response.ok) {
      throw new Error(
        `conversations.list failed: ${response.error ?? "unknown"}`,
      );
    }

    for (const ch of response.channels ?? []) {
      if (ch.id && ch.name) {
        channels.push({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private ?? false,
        });
      }
    }

    cursor = response.response_metadata?.next_cursor ?? undefined;
  } while (cursor);

  return channels.sort((a, b) => a.name.localeCompare(b.name));
}

// --- getChannelMessages ---

export async function getChannelMessages(
  botToken: string,
  channelId: string,
  limit = 20,
): Promise<SlackMessage[]> {
  const client = new WebClient(botToken);
  const userCache = new Map<string, string>();

  const response = await client.conversations.history({
    channel: channelId,
    limit,
  });

  if (!response.ok) {
    throw new Error(
      `conversations.history failed: ${response.error ?? "unknown"}`,
    );
  }

  const messages: SlackMessage[] = [];

  for (const msg of response.messages ?? []) {
    if (!msg.ts || !msg.text) continue;

    let userName: string | undefined;
    const userId = msg.user ?? msg.bot_id ?? "";

    if (userId) {
      if (userCache.has(userId)) {
        userName = userCache.get(userId);
      } else {
        try {
          const userInfo = await client.users.info({ user: userId });
          const name =
            userInfo.user?.profile?.display_name ||
            userInfo.user?.profile?.real_name ||
            userInfo.user?.name ||
            userId;
          userCache.set(userId, name);
          userName = name;
        } catch {
          userCache.set(userId, userId);
          userName = userId;
        }
      }
    }

    messages.push({
      ts: msg.ts,
      user: userId,
      user_name: userName,
      text: msg.text,
    });
  }

  // Newest first (Slack returns newest first already, but sort to be safe)
  messages.sort((a, b) => parseFloat(b.ts) - parseFloat(a.ts));

  return messages;
}

// --- postMessage ---

export async function postMessage(
  botToken: string,
  channelId: string,
  text: string,
  blocks?: KnownBlock[],
): Promise<void> {
  const client = new WebClient(botToken);
  const response = await client.chat.postMessage({
    channel: channelId,
    text,
    ...(blocks ? { blocks } : {}),
  });

  if (!response.ok) {
    throw new Error(`chat.postMessage failed: ${response.error ?? "unknown"}`);
  }
}

// --- formatMeetingSummary ---

export interface MeetingSummaryInput {
  title: string;
  date: string;
  participants: string[];
  decisions: string[];
  action_items: Array<{ title: string; assignee?: string | null }>;
}

export interface SlackMessagePayload {
  text: string;
  blocks: KnownBlock[];
}

export function formatMeetingSummary(
  meeting: MeetingSummaryInput,
): SlackMessagePayload {
  const formattedDate = new Date(meeting.date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const participantLines =
    meeting.participants.length > 0
      ? meeting.participants.map((p) => `• ${p}`).join("\n")
      : "• None recorded";

  const decisionLines =
    meeting.decisions.length > 0
      ? meeting.decisions.map((d) => `• ${d}`).join("\n")
      : "None recorded";

  const actionLines =
    meeting.action_items.length > 0
      ? meeting.action_items
          .map((a) => `• ${a.title}${a.assignee ? ` — *${a.assignee}*` : ""}`)
          .join("\n")
      : "None";

  const blocks: KnownBlock[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${meeting.title} — ${formattedDate}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Participants*\n${participantLines}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Key Decisions*\n${decisionLines}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Action Items*\n${actionLines}`,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Posted by FractionalBuddy • ${new Date().toLocaleString("en-GB")}`,
        },
      ],
    },
  ];

  return {
    text: `Meeting summary: ${meeting.title} — ${formattedDate}`,
    blocks,
  };
}

// --- formatTaskUpdate ---

export type TaskAction = "created" | "updated" | "completed";

export interface TaskUpdateInput {
  title: string;
  assignee?: string | null;
  status?: string | null;
}

export function formatTaskUpdate(
  task: TaskUpdateInput,
  action: TaskAction,
): SlackMessagePayload {
  const emoji =
    action === "created"
      ? ":clipboard:"
      : action === "updated"
        ? ":pencil2:"
        : ":white_check_mark:";

  const lines = [`${emoji} Task ${action}: *${task.title}*`];
  if (task.assignee) {
    lines.push(`Assigned to: ${task.assignee}`);
  }

  const blocks: KnownBlock[] = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: lines.join("\n"),
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: "FractionalBuddy",
        },
      ],
    },
  ];

  return {
    text: `Task ${action}: ${task.title}`,
    blocks,
  };
}

// --- searchMessages ---

export async function searchMessages(
  userToken: string,
  query: string,
  channelName?: string,
): Promise<SlackMessage[]> {
  const client = new WebClient(userToken);

  const fullQuery = channelName ? `in:#${channelName} ${query}` : query;

  const response = await client.search.messages({
    query: fullQuery,
    count: 20,
  });

  if (!response.ok) {
    throw new Error(`search.messages failed: ${response.error ?? "unknown"}`);
  }

  const matches = response.messages?.matches ?? [];

  return matches
    .filter((m) => m.ts && m.text)
    .map((m) => ({
      ts: m.ts!,
      user: m.user ?? "",
      user_name: m.username,
      text: m.text!,
      permalink: m.permalink,
    }));
}

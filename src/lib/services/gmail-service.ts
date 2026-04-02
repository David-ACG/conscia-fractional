import { google, gmail_v1 } from "googleapis";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function hasFullAccess(scopes: string[]): boolean {
  return scopes.includes(GMAIL_READONLY_SCOPE);
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
}

export function getGmailClient(accessToken: string): gmail_v1.Gmail {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

export async function listMessages(
  gmail: gmail_v1.Gmail,
  query: string,
  maxResults = 20,
  pageToken?: string,
): Promise<{ messages: GmailMessageMeta[]; nextPageToken?: string }> {
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
    ...(pageToken ? { pageToken } : {}),
  });

  const messageIds = listRes.data.messages ?? [];
  const nextPageToken = listRes.data.nextPageToken ?? undefined;

  if (messageIds.length === 0) {
    return { messages: [], nextPageToken };
  }

  const messageDetails = await Promise.all(
    messageIds.map((m) =>
      gmail.users.messages.get({
        userId: "me",
        id: m.id!,
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      }),
    ),
  );

  const messages: GmailMessageMeta[] = messageDetails.map((res) => {
    const msg = res.data;
    const headers = msg.payload?.headers ?? [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())
        ?.value ?? "";

    return {
      id: msg.id ?? "",
      threadId: msg.threadId ?? "",
      subject: getHeader("Subject"),
      from: getHeader("From"),
      to: getHeader("To"),
      date: getHeader("Date"),
      snippet: msg.snippet ?? "",
    };
  });

  // Newest first
  messages.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return { messages, nextPageToken };
}

export async function listMessagesForCustomer(
  gmail: gmail_v1.Gmail,
  contacts: { email: string }[],
  maxResults = 20,
  pageToken?: string,
): Promise<{ messages: GmailMessageMeta[]; nextPageToken?: string }> {
  if (contacts.length === 0) {
    return { messages: [] };
  }

  const parts = contacts.map((c) => `from:${c.email} OR to:${c.email}`);
  const query = `(${parts.join(" OR ")})`;

  return listMessages(gmail, query, maxResults, pageToken);
}

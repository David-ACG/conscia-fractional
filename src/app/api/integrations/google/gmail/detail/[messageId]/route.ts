import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/services/google-auth-service";
import { getGmailClient, hasFullAccess } from "@/lib/services/gmail-service";
import type { gmail_v1 } from "googleapis";

export interface GmailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

export interface GmailDetailResponse {
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  attachments: GmailAttachmentMeta[];
  hasFullAccess: boolean;
  upgradeMessage?: string;
}

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.readonly",
];

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return (
    headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ??
    ""
  );
}

function decodeBase64Url(data: string): string {
  // Gmail uses URL-safe base64 encoding
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

function extractBodies(payload: gmail_v1.Schema$MessagePart): {
  text?: string;
  html?: string;
} {
  let text: string | undefined;
  let html: string | undefined;

  // Single-part message (no parts array)
  if (!payload.parts && payload.body?.data) {
    if (payload.mimeType === "text/plain") {
      text = decodeBase64Url(payload.body.data);
    } else if (payload.mimeType === "text/html") {
      html = decodeBase64Url(payload.body.data);
    }
    return { text, html };
  }

  // Multipart: walk recursively
  function walk(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.mimeType === "text/plain" && part.body?.data && !text) {
        text = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/html" && part.body?.data && !html) {
        html = decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  walk(payload.parts);
  return { text, html };
}

function extractAttachments(
  payload: gmail_v1.Schema$MessagePart,
): GmailAttachmentMeta[] {
  const attachments: GmailAttachmentMeta[] = [];

  function walk(parts: gmail_v1.Schema$MessagePart[] | undefined) {
    if (!parts) return;
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType ?? "application/octet-stream",
          size: part.body?.size ?? 0,
          attachmentId: part.body?.attachmentId ?? "",
        });
      }
      if (part.parts) {
        walk(part.parts);
      }
    }
  }

  walk(payload.parts);
  return attachments;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> },
) {
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

  const { messageId } = await params;
  const { searchParams } = new URL(request.url);
  const integrationId = searchParams.get("integration_id");

  if (!integrationId) {
    return NextResponse.json(
      { error: "Missing required parameter: integration_id" },
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

  const scopes: string[] = integration.scopes ?? [];
  const hasGmailScope = GMAIL_SCOPES.some((s) => scopes.includes(s));
  if (!hasGmailScope) {
    return NextResponse.json(
      { error: "Gmail scope not authorized" },
      { status: 403 },
    );
  }

  const fullAccess = hasFullAccess(scopes);

  try {
    const accessToken = await getValidAccessToken(integrationId);
    const gmail = getGmailClient(accessToken);

    const res = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: fullAccess ? "full" : "metadata",
      ...(fullAccess
        ? {}
        : { metadataHeaders: ["Subject", "From", "To", "Cc", "Date"] }),
    });

    const msg = res.data;
    const headers = msg.payload?.headers;

    const subject = getHeader(headers, "Subject");
    const from = getHeader(headers, "From");
    const to = getHeader(headers, "To");
    const cc = getHeader(headers, "Cc");
    const date = getHeader(headers, "Date");

    if (fullAccess && msg.payload) {
      const { text, html } = extractBodies(msg.payload);
      const attachments = extractAttachments(msg.payload);

      const response: GmailDetailResponse = {
        subject,
        from,
        to,
        ...(cc ? { cc } : {}),
        date,
        body_text: text,
        body_html: html,
        attachments,
        hasFullAccess: true,
      };

      return NextResponse.json(response);
    }

    // Metadata-only response
    const response: GmailDetailResponse = {
      subject,
      from,
      to,
      date,
      snippet: msg.snippet ?? "",
      attachments: [],
      hasFullAccess: false,
      upgradeMessage: "Upgrade to full Gmail access to see email bodies",
    };

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message.includes("not found") || message.includes("Not Found")) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

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

"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink,
  Reply,
  Paperclip,
  FileText,
  Image as ImageIcon,
  File,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import DOMPurify from "dompurify";
import type { ReplyContext } from "./email-compose";

interface AttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
}

interface EmailDetail {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  cc?: string;
  date: string;
  messageIdHeader?: string;
  body_text?: string;
  body_html?: string;
  snippet?: string;
  attachments: AttachmentMeta[];
  hasFullAccess: boolean;
  upgradeMessage?: string;
}

interface EmailDetailDialogProps {
  messageId: string;
  integrationId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReply?: (ctx: ReplyContext) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/"))
    return <ImageIcon className="h-4 w-4" aria-hidden="true" />;
  if (mimeType.includes("pdf"))
    return <FileText className="h-4 w-4" aria-hidden="true" />;
  return <File className="h-4 w-4" aria-hidden="true" />;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

export function EmailDetailDialog({
  messageId,
  integrationId,
  open,
  onOpenChange,
  onReply,
}: EmailDetailDialogProps) {
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async (msgId: string, intId: string) => {
    setLoading(true);
    setError(null);
    setDetail(null);

    const params = new URLSearchParams({ integration_id: intId });

    try {
      const res = await fetch(
        `/api/integrations/google/gmail/detail/${encodeURIComponent(msgId)}?${params}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data: EmailDetail = await res.json();
      setDetail(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !messageId) return;
    fetchDetail(messageId, integrationId);
  }, [open, messageId, integrationId, fetchDetail]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        {loading && (
          <div className="space-y-4" data-testid="email-detail-loading">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {detail && !loading && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg pr-6">
                {detail.subject || "(no subject)"}
              </DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">From:</span>{" "}
                    {detail.from}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">To:</span>{" "}
                    {detail.to}
                  </div>
                  {detail.cc && (
                    <div>
                      <span className="font-medium text-foreground">Cc:</span>{" "}
                      {detail.cc}
                    </div>
                  )}
                  <div>{formatDate(detail.date)}</div>
                </div>
              </DialogDescription>
            </DialogHeader>

            {/* Body section */}
            <div className="mt-2">
              {detail.hasFullAccess ? (
                <>
                  {detail.body_html ? (
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert overflow-auto max-h-96 rounded border p-3"
                      data-testid="email-html-body"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(detail.body_html, {
                          FORBID_TAGS: ["script", "style"],
                          FORBID_ATTR: ["onerror", "onload", "onclick"],
                        }),
                      }}
                    />
                  ) : detail.body_text ? (
                    <pre
                      className="whitespace-pre-wrap text-sm rounded border p-3 overflow-auto max-h-96"
                      data-testid="email-text-body"
                    >
                      {detail.body_text}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No body content
                    </p>
                  )}
                </>
              ) : (
                <div className="space-y-3" data-testid="email-upgrade-message">
                  {detail.snippet && (
                    <p className="text-sm text-muted-foreground italic">
                      {detail.snippet}
                    </p>
                  )}
                  <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                    <span>
                      {detail.upgradeMessage}{" "}
                      <a
                        href="/dashboard/settings"
                        className="underline font-medium"
                      >
                        Go to Settings
                      </a>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Attachments */}
            {detail.hasFullAccess && detail.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  <Paperclip className="h-4 w-4" />
                  Attachments ({detail.attachments.length})
                </div>
                <div className="space-y-1">
                  {detail.attachments.map((att, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded border p-2 text-sm"
                      data-testid="email-attachment"
                    >
                      <AttachmentIcon mimeType={att.mimeType} />
                      <span className="truncate">{att.filename}</span>
                      <span className="flex-shrink-0 text-muted-foreground">
                        {formatSize(att.size)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={!onReply}
                onClick={() => {
                  if (onReply && detail) {
                    onReply({
                      messageId: detail.id,
                      threadId: detail.threadId,
                      subject: detail.subject,
                      from: detail.from,
                      snippet:
                        detail.body_text?.slice(0, 500) ?? detail.snippet ?? "",
                      inReplyTo: detail.messageIdHeader,
                      references: detail.messageIdHeader,
                    });
                  }
                }}
                data-testid="reply-button"
              >
                <Reply className="h-4 w-4 mr-1.5" />
                Reply
              </Button>
              <Button asChild size="sm">
                <a
                  href={`https://mail.google.com/mail/u/0/#inbox/${messageId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="open-in-gmail-detail"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  Open in Gmail
                </a>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

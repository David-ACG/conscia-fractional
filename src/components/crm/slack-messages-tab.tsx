"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SlackSearch } from "./slack-search";

// --- Types ---

interface SlackMessage {
  ts: string;
  user: string;
  user_name?: string;
  text: string;
  permalink?: string;
}

interface SlackMapping {
  id: string;
  channel_id: string;
  channel_name: string;
  crm_customer_id: string;
  integration_id: string;
}

interface SlackMessagesTabProps {
  customerId: string;
}

// --- Helpers ---

function tsToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000);
}

function renderSlackText(text: string): string {
  // Basic Slack mrkdwn: *bold*, _italic_, <url|label>, <url>
  return text
    .replace(/\*(.+?)\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(
      /<(https?:\/\/[^|>]+)\|([^>]+)>/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline hover:text-foreground">$2</a>',
    )
    .replace(
      /<(https?:\/\/[^>]+)>/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline hover:text-foreground">$1</a>',
    )
    .replace(/\n/g, "<br />");
}

// --- Component ---

export function SlackMessagesTab({ customerId }: SlackMessagesTabProps) {
  const [mapping, setMapping] = React.useState<SlackMapping | null | undefined>(
    undefined,
  );
  const [messages, setMessages] = React.useState<SlackMessage[]>([]);
  const [isLoadingMapping, setIsLoadingMapping] = React.useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [messagesError, setMessagesError] = React.useState<string | null>(null);

  const loadMapping = React.useCallback(async () => {
    setIsLoadingMapping(true);
    try {
      // Get all Slack integrations' mappings via the settings approach:
      // We fetch mappings for this customer across all slack integrations
      const res = await fetch(
        `/api/integrations/slack/mapping/customer?customer_id=${customerId}`,
      );
      if (!res.ok) {
        setMapping(null);
        return;
      }
      const data: SlackMapping | null = await res.json();
      setMapping(data);
    } catch {
      setMapping(null);
    } finally {
      setIsLoadingMapping(false);
    }
  }, [customerId]);

  const loadMessages = React.useCallback(
    async (currentMapping: SlackMapping) => {
      setIsLoadingMessages(true);
      setMessagesError(null);
      try {
        const params = new URLSearchParams({
          channel_id: currentMapping.channel_id,
          integration_id: currentMapping.integration_id,
        });
        const res = await fetch(
          `/api/integrations/slack/messages?${params.toString()}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to fetch messages");
        }
        const data: SlackMessage[] = await res.json();
        setMessages(data);
      } catch (err) {
        setMessagesError(
          err instanceof Error ? err.message : "Failed to load messages",
        );
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    loadMapping();
  }, [loadMapping]);

  React.useEffect(() => {
    if (mapping) {
      loadMessages(mapping);
    }
  }, [mapping, loadMessages]);

  // Loading mapping
  if (isLoadingMapping) {
    return (
      <div className="space-y-3 py-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  // No channel mapped
  if (!mapping) {
    return (
      <div className="py-12 text-center">
        <MessageSquare className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="mb-1 font-medium">
          No Slack channel linked to this customer
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          Link a channel in Settings to see messages here.
        </p>
        <Button asChild variant="outline">
          <a href="/settings">Link a channel in Settings</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search */}
      <SlackSearch
        integrationId={mapping.integration_id}
        channelName={mapping.channel_name}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          #{mapping.channel_name}
        </span>
        <div className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadMessages(mapping)}
            disabled={isLoadingMessages}
            aria-label="Refresh messages"
          >
            {isLoadingMessages ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Error */}
      {messagesError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {messagesError}{" "}
          <button className="underline" onClick={() => loadMessages(mapping)}>
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {isLoadingMessages && messages.length === 0 && (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Empty state — channel mapped but no messages */}
      {!isLoadingMessages && !messagesError && messages.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No recent messages in #{mapping.channel_name}
          </p>
        </div>
      )}

      {/* Message list */}
      {messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.ts}
              className="rounded-md border bg-card px-4 py-3 text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {msg.user_name || msg.user || "Unknown"}
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span title={tsToDate(msg.ts).toLocaleString()}>
                    {formatDistanceToNow(tsToDate(msg.ts), { addSuffix: true })}
                  </span>
                  {msg.permalink && (
                    <a
                      href={msg.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open in Slack"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <p
                className="text-muted-foreground leading-relaxed"
                dangerouslySetInnerHTML={{ __html: renderSlackText(msg.text) }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

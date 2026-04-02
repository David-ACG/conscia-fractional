"use client";

import { useEffect, useState } from "react";
import { Mail, ExternalLink, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import type { GmailMessageMeta } from "@/lib/services/gmail-service";

interface GmailIntegration {
  id: string;
  account_identifier: string | null;
}

interface EmailTabProps {
  customerId: string;
}

function EmailSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-md border p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

function formatEmailDate(dateStr: string): string {
  if (!dateStr) return "";
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function isIncoming(from: string, contactEmails: string[]): boolean {
  const fromLower = from.toLowerCase();
  return contactEmails.some((email) => fromLower.includes(email.toLowerCase()));
}

function EmailRow({
  message,
  contactEmails,
}: {
  message: GmailMessageMeta;
  contactEmails: string[];
}) {
  const incoming = isIncoming(message.from, contactEmails);
  const showDirection = contactEmails.length > 0;

  return (
    <div className="rounded-md border p-4 space-y-1.5 hover:bg-muted/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-sm line-clamp-1">
          {message.subject || "(no subject)"}
        </span>
        <a
          href={`https://mail.google.com/mail/u/0/#inbox/${message.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Open in Gmail"
          data-testid="open-in-gmail"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {showDirection && (
          <Badge
            variant="outline"
            className="text-xs px-1.5 py-0 h-5 gap-1"
            data-testid={incoming ? "direction-incoming" : "direction-outgoing"}
          >
            {incoming ? (
              <>
                <ArrowDownLeft className="h-3 w-3" />
                Incoming
              </>
            ) : (
              <>
                <ArrowUpRight className="h-3 w-3" />
                Outgoing
              </>
            )}
          </Badge>
        )}
        <span className="truncate">{message.from}</span>
        <span>·</span>
        <span className="flex-shrink-0">{formatEmailDate(message.date)}</span>
      </div>

      {message.snippet && (
        <p className="text-xs text-muted-foreground line-clamp-2">
          {message.snippet}
        </p>
      )}
    </div>
  );
}

export function EmailTab({ customerId }: EmailTabProps) {
  const [integrations, setIntegrations] = useState<GmailIntegration[]>([]);
  const [selectedIntegrationId, setSelectedIntegrationId] =
    useState<string>("");
  const [messages, setMessages] = useState<GmailMessageMeta[]>([]);
  const [contactEmails, setContactEmails] = useState<string[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Gmail integrations on mount
  useEffect(() => {
    fetch("/api/integrations/google/gmail/integrations")
      .then((res) => res.json())
      .then((data) => {
        const ints: GmailIntegration[] = data.integrations ?? [];
        setIntegrations(ints);
        if (ints.length > 0) {
          setSelectedIntegrationId(ints[0].id);
        }
      })
      .catch(() => {
        // Silent fail — will show no-gmail empty state
      })
      .finally(() => setLoadingIntegrations(false));
  }, []);

  // Fetch messages when integration changes
  useEffect(() => {
    if (!selectedIntegrationId) return;

    setLoadingMessages(true);
    setError(null);
    setMessages([]);
    setContactEmails([]);
    setNextPageToken(undefined);

    const params = new URLSearchParams({
      crm_customer_id: customerId,
      integration_id: selectedIntegrationId,
    });

    fetch(`/api/integrations/google/gmail/messages?${params}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        setMessages(data.messages ?? []);
        setContactEmails(data.contactEmails ?? []);
        setNextPageToken(data.nextPageToken);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoadingMessages(false));
  }, [selectedIntegrationId, customerId]);

  async function handleLoadMore() {
    if (!nextPageToken || !selectedIntegrationId || loadingMore) return;

    setLoadingMore(true);
    const params = new URLSearchParams({
      crm_customer_id: customerId,
      integration_id: selectedIntegrationId,
      page_token: nextPageToken,
    });

    try {
      const res = await fetch(
        `/api/integrations/google/gmail/messages?${params}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const data = await res.json();
      setMessages((prev) => [...prev, ...(data.messages ?? [])]);
      setNextPageToken(data.nextPageToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load more");
    } finally {
      setLoadingMore(false);
    }
  }

  // Loading integrations
  if (loadingIntegrations) {
    return <EmailSkeleton />;
  }

  // No Gmail integration connected
  if (integrations.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <Mail className="h-10 w-10 mx-auto text-muted-foreground" />
        <p className="text-muted-foreground">Connect Gmail to see emails</p>
        <Button asChild size="sm">
          <a href="/dashboard/settings">Connect Gmail</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Account selector (multiple Gmail accounts) */}
      {integrations.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Account:</span>
          <select
            value={selectedIntegrationId}
            onChange={(e) => setSelectedIntegrationId(e.target.value)}
            className="text-sm rounded-md border px-2 py-1 bg-background"
            aria-label="Select Gmail account"
          >
            {integrations.map((i) => (
              <option key={i.id} value={i.id}>
                {i.account_identifier ?? i.id}
              </option>
            ))}
          </select>
        </div>
      )}

      {loadingMessages && <EmailSkeleton />}

      {!loadingMessages && error && (
        <div className="py-6 text-center text-destructive text-sm">{error}</div>
      )}

      {!loadingMessages && !error && messages.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            No emails found for this customer&apos;s contacts
          </p>
        </div>
      )}

      {!loadingMessages && !error && messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((msg) => (
            <EmailRow
              key={msg.id}
              message={msg}
              contactEmails={contactEmails}
            />
          ))}
        </div>
      )}

      {nextPageToken && !loadingMessages && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  );
}

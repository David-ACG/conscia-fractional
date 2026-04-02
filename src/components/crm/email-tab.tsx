"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import {
  Mail,
  ExternalLink,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  X,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";
import { EmailDetailDialog } from "./email-detail-dialog";
import { EmailCompose, type ReplyContext } from "./email-compose";
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
  onClick,
}: {
  message: GmailMessageMeta;
  contactEmails: string[];
  onClick: () => void;
}) {
  const incoming = isIncoming(message.from, contactEmails);
  const showDirection = contactEmails.length > 0;

  return (
    <div
      className="rounded-md border p-4 space-y-1.5 hover:bg-muted/30 transition-colors cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      data-testid="email-row"
    >
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
          onClick={(e) => e.stopPropagation()}
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

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detail dialog state
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(
    null,
  );
  const [detailOpen, setDetailOpen] = useState(false);

  // Compose dialog state
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyContext, setReplyContext] = useState<ReplyContext | undefined>();

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

  // Fetch messages when integration changes (regular listing)
  useEffect(() => {
    if (!selectedIntegrationId || isSearchActive) return;

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
  }, [selectedIntegrationId, customerId, isSearchActive]);

  const performSearch = useCallback(
    (query: string) => {
      if (!selectedIntegrationId || !query.trim()) return;

      setLoadingMessages(true);
      setError(null);
      setMessages([]);
      setNextPageToken(undefined);

      const params = new URLSearchParams({
        q: query.trim(),
        integration_id: selectedIntegrationId,
        crm_customer_id: customerId,
      });

      fetch(`/api/integrations/google/gmail/search?${params}`)
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `Request failed (${res.status})`);
          }
          return res.json();
        })
        .then((data) => {
          setMessages(data.messages ?? []);
          setNextPageToken(data.nextPageToken);
        })
        .catch((e: Error) => setError(e.message))
        .finally(() => setLoadingMessages(false));
    },
    [selectedIntegrationId, customerId],
  );

  function handleSearchChange(value: string) {
    setSearchQuery(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!value.trim()) {
      setIsSearchActive(false);
      return;
    }

    debounceTimer.current = setTimeout(() => {
      setIsSearchActive(true);
      performSearch(value);
    }, 500);
  }

  function handleClearSearch() {
    setSearchQuery("");
    setIsSearchActive(false);
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
  }

  async function handleLoadMore() {
    if (!nextPageToken || !selectedIntegrationId || loadingMore) return;

    setLoadingMore(true);

    const baseUrl = isSearchActive
      ? "/api/integrations/google/gmail/search"
      : "/api/integrations/google/gmail/messages";

    const params = new URLSearchParams({
      ...(isSearchActive
        ? { q: searchQuery.trim(), crm_customer_id: customerId }
        : { crm_customer_id: customerId }),
      integration_id: selectedIntegrationId,
      page_token: nextPageToken,
    });

    try {
      const res = await fetch(`${baseUrl}?${params}`);
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

  function handleEmailClick(messageId: string) {
    setSelectedMessageId(messageId);
    setDetailOpen(true);
  }

  function handleCompose() {
    setReplyContext(undefined);
    setComposeOpen(true);
  }

  function handleReply(ctx: ReplyContext) {
    setDetailOpen(false);
    setReplyContext(ctx);
    setComposeOpen(true);
  }

  function handleEmailSent() {
    // Refresh the message list
    setIsSearchActive(false);
    setSearchQuery("");
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

      {/* Search + Compose */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails... (subject:, from:, has:attachment)"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search emails"
            data-testid="email-search-input"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              data-testid="email-search-clear"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCompose}
          data-testid="email-compose-button"
        >
          <PenSquare className="h-4 w-4 mr-1.5" />
          Compose
        </Button>
      </div>

      {loadingMessages && <EmailSkeleton />}

      {!loadingMessages && error && (
        <div className="py-6 text-center text-destructive text-sm">{error}</div>
      )}

      {!loadingMessages && !error && messages.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-muted-foreground">
            {isSearchActive
              ? "No emails found matching your search"
              : "No emails found for this customer\u2019s contacts"}
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
              onClick={() => handleEmailClick(msg.id)}
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

      {/* Email detail dialog */}
      {selectedMessageId && (
        <EmailDetailDialog
          messageId={selectedMessageId}
          integrationId={selectedIntegrationId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onReply={handleReply}
        />
      )}

      {/* Compose dialog */}
      <EmailCompose
        customerId={customerId}
        open={composeOpen}
        onOpenChange={setComposeOpen}
        replyTo={replyContext}
        onSent={handleEmailSent}
      />
    </div>
  );
}

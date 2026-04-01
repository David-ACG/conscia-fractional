"use client";

import * as React from "react";
import { formatDistanceToNow } from "date-fns";
import { Search, ExternalLink, Loader2, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// --- Types ---

interface SearchMessage {
  ts: string;
  user: string;
  user_name?: string;
  text: string;
  permalink?: string;
  channel_name?: string;
}

interface SearchResult {
  messages: SearchMessage[];
  total: number;
  page: number;
  has_more: boolean;
}

interface SlackSearchProps {
  integrationId: string;
  channelName?: string;
}

// --- Helpers ---

function tsToDate(ts: string): Date {
  return new Date(parseFloat(ts) * 1000);
}

// --- Component ---

export function SlackSearch({ integrationId, channelName }: SlackSearchProps) {
  const [query, setQuery] = React.useState("");
  const [searchAll, setSearchAll] = React.useState(false);
  const [result, setResult] = React.useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [allMessages, setAllMessages] = React.useState<SearchMessage[]>([]);

  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = React.useCallback(
    async (q: string, p: number, append: boolean) => {
      if (!q.trim()) {
        setResult(null);
        setAllMessages([]);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          q,
          integration_id: integrationId,
          page: String(p),
          per_page: "20",
        });

        if (!searchAll && channelName) {
          params.set("channel_name", channelName);
        }

        const res = await fetch(
          `/api/integrations/slack/search?${params.toString()}`,
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? "Search failed");
        }

        const data: SearchResult = await res.json();
        setResult(data);
        setAllMessages((prev) =>
          append ? [...prev, ...data.messages] : data.messages,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setIsLoading(false);
      }
    },
    [integrationId, channelName, searchAll],
  );

  const handleQueryChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const q = e.target.value;
      setQuery(q);
      setPage(1);
      setAllMessages([]);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSearch(q, 1, false);
      }, 300);
    },
    [doSearch],
  );

  // Re-search when scope toggle changes
  React.useEffect(() => {
    if (!query.trim()) return;
    setPage(1);
    setAllMessages([]);
    doSearch(query, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchAll]);

  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    doSearch(query, nextPage, true);
  };

  const showResults = !isLoading && query.trim() && allMessages.length > 0;
  const showEmpty =
    !isLoading && query.trim() && allMessages.length === 0 && result !== null;

  return (
    <div className="space-y-3 border-b pb-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search messages…"
          value={query}
          onChange={handleQueryChange}
          className="pl-9"
          aria-label="Search Slack messages"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* Scope toggle */}
      {channelName && (
        <div className="flex items-center gap-2">
          <Switch
            id="search-all-channels"
            checked={searchAll}
            onCheckedChange={setSearchAll}
          />
          <Label
            htmlFor="search-all-channels"
            className="text-xs cursor-pointer text-muted-foreground"
          >
            Search all channels
          </Label>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Empty state */}
      {showEmpty && (
        <p className="py-4 text-center text-sm text-muted-foreground">
          No results found for &ldquo;{query}&rdquo;
        </p>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {result?.total ?? allMessages.length} result
            {(result?.total ?? allMessages.length) !== 1 ? "s" : ""}
          </p>
          {allMessages.map((msg) => (
            <div
              key={`${msg.ts}-${msg.user}`}
              className="rounded-md border bg-card px-3 py-2 text-sm"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="font-semibold text-xs">
                  {msg.user_name || msg.user || "Unknown"}
                  {msg.channel_name && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      in #{msg.channel_name}
                    </span>
                  )}
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
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label="Open in Slack"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open in Slack
                    </a>
                  )}
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed line-clamp-3">
                {msg.text}
              </p>
            </div>
          ))}

          {result?.has_more && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="mr-2 h-4 w-4" />
              )}
              Load more
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

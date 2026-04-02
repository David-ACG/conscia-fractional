"use client";

import * as React from "react";
import { Send, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { SearchResult } from "@/lib/services/rag-service";
import { DocumentList } from "@/components/crm/document-list";

interface Source {
  name: string;
  sourceType: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  results?: SearchResult[];
  timestamp: Date;
}

interface DocumentChatProps {
  customerId: string;
  customerName: string;
}

const EXAMPLE_QUESTIONS = [
  "What are the main challenges discussed?",
  "What deliverables were agreed?",
  "What are the next steps?",
  "What is the current project status?",
];

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
    </div>
  );
}

function SimpleMarkdown({ text }: { text: string }) {
  // Very minimal markdown: bold, italic, bullet lists
  const lines = text.split("\n");
  return (
    <div className="space-y-1 text-sm">
      {lines.map((line, i) => {
        // Bullet list
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2);
          return (
            <div key={i} className="flex gap-2">
              <span className="mt-0.5 shrink-0 text-muted-foreground">•</span>
              <span
                dangerouslySetInnerHTML={{ __html: formatInline(content) }}
              />
            </div>
          );
        }
        if (line === "") return <div key={i} className="h-2" />;
        return (
          <p key={i} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
        );
      })}
    </div>
  );
}

function formatInline(text: string): string {
  // Bold: **text**
  let result = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Italic: *text* (but not **)
  result = result.replace(
    /(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g,
    "<em>$1</em>",
  );
  return result;
}

function AssistantMessage({ message }: { message: Message }) {
  const [showContext, setShowContext] = React.useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="max-w-[85%] rounded-lg bg-muted px-4 py-3">
        <SimpleMarkdown text={message.content} />

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2">
            {message.sources.map((s, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                <FileText className="mr-1 h-3 w-3" />
                {s.name}
                <span className="ml-1 text-muted-foreground">
                  ({s.sourceType})
                </span>
              </Badge>
            ))}
          </div>
        )}

        {message.results && message.results.length > 0 && (
          <button
            onClick={() => setShowContext((v) => !v)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {showContext ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {showContext ? "Hide context" : "Show context"}
          </button>
        )}
      </div>

      {showContext && message.results && message.results.length > 0 && (
        <div className="ml-2 space-y-2">
          {message.results.map((r, i) => (
            <div
              key={i}
              className="rounded border bg-muted/40 px-3 py-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium">{r.documentName}</span>
                <span className="text-muted-foreground">
                  score: {r.score.toFixed(3)}
                </span>
              </div>
              <p className="text-muted-foreground line-clamp-4">{r.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentChat({ customerId, customerName }: DocumentChatProps) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [hasDocuments, setHasDocuments] = React.useState<boolean | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Check if documents exist for this customer
  React.useEffect(() => {
    fetch(
      `/api/documents/list?crm_customer_id=${encodeURIComponent(customerId)}`,
    )
      .then((r) => r.json())
      .then((data: { documents?: unknown[] }) => {
        setHasDocuments(
          Array.isArray(data.documents) && data.documents.length > 0,
        );
      })
      .catch(() => {
        setHasDocuments(false);
      });
  }, [customerId]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setMessages((prev) => [
      ...prev,
      { role: "user", content: query, timestamp: new Date() },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          crm_customer_id: customerId,
          generate_answer: true,
        }),
      });

      const data = (await res.json()) as {
        answer?: string;
        sources?: Source[];
        results?: SearchResult[];
        error?: string;
      };

      if (!res.ok || data.error) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error ?? "Something went wrong. Please try again.",
            timestamp: new Date(),
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer ?? "No answer generated.",
          sources: data.sources,
          results: data.results,
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Failed to reach the server. Please check your connection.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  // Empty state — waiting for document check
  if (hasDocuments === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Empty state — no documents
  if (hasDocuments === false && messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">
          No documents found for this customer. Upload documents or wait for
          automatic embedding to start asking questions.
        </p>
        <a
          href="/dashboard/documents"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Go to Documents
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DocumentList
        customerId={customerId}
        onDocumentChange={() => setHasDocuments(true)}
      />
      <div className="flex h-[600px] flex-col rounded-lg border">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <p className="text-sm font-medium">
                Ask a question about {customerName}
              </p>
              <div className="flex flex-col gap-2 w-full max-w-sm">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                      textareaRef.current?.focus();
                    }}
                    className="rounded-lg border px-3 py-2 text-sm text-left text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-primary px-4 py-3 text-sm text-primary-foreground">
                  {msg.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-start">
                <AssistantMessage message={msg} />
              </div>
            ),
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-muted">
                <TypingIndicator />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder={`Ask about ${customerName}…`}
              rows={1}
              className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              style={{ maxHeight: "120px", overflowY: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
            />
            <Button
              size="icon"
              onClick={() => void sendMessage()}
              disabled={loading || !input.trim()}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

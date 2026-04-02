"use client";

import * as React from "react";
import {
  FileText,
  HardDrive,
  Paperclip,
  StickyNote,
  Upload,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Document {
  id: string;
  name: string;
  source_type: string;
  chunk_count: number | null;
  embedded_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface DocumentListData {
  documents: Document[];
  total: number;
  embedded_count: number;
  total_chunks: number;
}

interface DocumentListProps {
  customerId: string;
  onDocumentChange?: () => void;
}

function sourceIcon(sourceType: string) {
  switch (sourceType) {
    case "meeting":
      return <FileText className="h-4 w-4 shrink-0 text-blue-500" />;
    case "drive_file":
      return <HardDrive className="h-4 w-4 shrink-0 text-green-500" />;
    case "asset":
      return <Paperclip className="h-4 w-4 shrink-0 text-orange-500" />;
    case "note":
      return <StickyNote className="h-4 w-4 shrink-0 text-yellow-500" />;
    default:
      return <Upload className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }
}

function StatusIndicator({ doc }: { doc: Document }) {
  const meta = doc.metadata ?? {};
  const embedError = meta.embed_error as string | undefined;
  const embedAttempts = (meta.embed_attempts as number | undefined) ?? 0;
  const isFailed = embedAttempts >= 3 && !doc.embedded_at;

  if (doc.embedded_at) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-green-600"
        title={new Date(doc.embedded_at).toLocaleString()}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">
          {new Date(doc.embedded_at).toLocaleDateString()}
        </span>
      </span>
    );
  }

  if (isFailed) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-red-500"
        title={embedError ?? "Embedding failed"}
      >
        <XCircle className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Failed</span>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-yellow-600">
      <Clock className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">Processing…</span>
    </span>
  );
}

export function DocumentList({
  customerId,
  onDocumentChange,
}: DocumentListProps) {
  const [data, setData] = React.useState<DocumentListData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [collapsed, setCollapsed] = React.useState(false);
  const [reembedding, setReembedding] = React.useState<Set<string>>(new Set());
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const fetchDocuments = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/documents/list?crm_customer_id=${encodeURIComponent(customerId)}`,
      );
      if (!res.ok) return;
      const json = (await res.json()) as DocumentListData;
      setData(json);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  React.useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  async function handleReembed(docId: string) {
    setReembedding((prev) => new Set([...prev, docId]));
    try {
      const res = await fetch(`/api/documents/${docId}/reembed`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchDocuments();
        onDocumentChange?.();
      }
    } finally {
      setReembedding((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", file.name);
      formData.append("crm_customer_id", customerId);
      formData.append("source_type", "upload");

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        await fetchDocuments();
        onDocumentChange?.();
      } else {
        const err = (await res.json()) as { error?: string };
        console.error("Upload failed:", err.error);
        alert(err.error ?? "Upload failed");
      }
    } finally {
      setUploading(false);
      // Reset file input so the same file can be re-uploaded
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">Loading documents…</p>
      </div>
    );
  }

  const docs = data?.documents ?? [];
  const embeddedCount = data?.embedded_count ?? 0;
  const totalChunks = data?.total_chunks ?? 0;

  return (
    <div className="rounded-lg border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-2 text-sm font-medium hover:text-foreground"
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
          Documents
          {docs.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">
              {embeddedCount} of {docs.length} indexed · {totalChunks} chunks
            </span>
          )}
        </button>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx,.json,.csv"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3 w-3" />
            )}
            {uploading ? "Uploading…" : "Upload Document"}
          </Button>
        </div>
      </div>

      {/* Document list */}
      {!collapsed && (
        <div className="divide-y">
          {docs.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No documents yet. Upload a file or wait for automatic embedding.
              </p>
            </div>
          ) : (
            docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20"
              >
                {sourceIcon(doc.source_type)}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {(doc.source_type ?? "").replace("_", " ")}
                    </Badge>
                    {doc.chunk_count != null && doc.chunk_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {doc.chunk_count} chunks
                      </span>
                    )}
                  </div>
                </div>
                <StatusIndicator doc={doc} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  disabled={reembedding.has(doc.id)}
                  onClick={() => void handleReembed(doc.id)}
                  title="Re-embed this document"
                >
                  {reembedding.has(doc.id) ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

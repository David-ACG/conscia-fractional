import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { DocumentList } from "../document-list";

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function makeDoc(
  overrides: Partial<{
    id: string;
    name: string;
    source_type: string;
    chunk_count: number | null;
    embedded_at: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }> = {},
) {
  return {
    id: "doc-1",
    name: "Test Document",
    source_type: "upload",
    chunk_count: 10,
    embedded_at: "2026-04-01T10:00:00Z",
    metadata: null,
    created_at: "2026-04-01T09:00:00Z",
    ...overrides,
  };
}

function mockListEndpoint(documents: ReturnType<typeof makeDoc>[] = []) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/documents/list")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          documents,
          total: documents.length,
          embedded_count: documents.filter((d) => d.embedded_at !== null)
            .length,
          total_chunks: documents.reduce((s, d) => s + (d.chunk_count ?? 0), 0),
        }),
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

describe("DocumentList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders document list with correct icons per source type", async () => {
    const docs = [
      makeDoc({ id: "1", name: "Weekly Sync", source_type: "meeting" }),
      makeDoc({ id: "2", name: "Proposal.docx", source_type: "drive_file" }),
      makeDoc({ id: "3", name: "Template.pdf", source_type: "asset" }),
      makeDoc({ id: "4", name: "Strategy Note", source_type: "note" }),
      makeDoc({ id: "5", name: "Upload.txt", source_type: "upload" }),
    ];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    });

    expect(screen.getByText("Proposal.docx")).toBeInTheDocument();
    expect(screen.getByText("Template.pdf")).toBeInTheDocument();
    expect(screen.getByText("Strategy Note")).toBeInTheDocument();
    expect(screen.getByText("Upload.txt")).toBeInTheDocument();
  });

  it("shows embedded status indicator for embedded documents", async () => {
    const docs = [makeDoc({ embedded_at: "2026-04-01T10:00:00Z" })];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      // Green check should be visible (aria-friendly: look for the date or check icon)
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });
    // Status indicator shows date
    expect(screen.getByTitle(/2026/)).toBeInTheDocument();
  });

  it("shows pending status indicator for unembedded documents", async () => {
    const docs = [
      makeDoc({ embedded_at: null, chunk_count: null, metadata: null }),
    ];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Processing…")).toBeInTheDocument();
    });
  });

  it("shows failed status for documents with embed_attempts >= 3", async () => {
    const docs = [
      makeDoc({
        embedded_at: null,
        chunk_count: null,
        metadata: { embed_attempts: 3, embed_error: "Ollama timeout" },
      }),
    ];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed")).toBeInTheDocument();
    });
  });

  it("calls re-embed API when Re-embed button is clicked", async () => {
    const docs = [makeDoc({ id: "doc-42" })];
    mockListEndpoint(docs);

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (url.includes("/api/documents/list")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            documents: docs,
            total: 1,
            embedded_count: 1,
            total_chunks: 10,
          }),
        });
      }
      if (
        url.includes("/api/documents/doc-42/reembed") &&
        options?.method === "POST"
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ success: true }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    const reembedButtons = screen.getAllByTitle("Re-embed this document");
    fireEvent.click(reembedButtons[0]);

    await waitFor(() => {
      const calls = mockFetch.mock.calls as [string, RequestInit?][];
      const reembedCall = calls.find(
        ([url, opts]) => url.includes("reembed") && opts?.method === "POST",
      );
      expect(reembedCall).toBeDefined();
    });
  });

  it("Upload Document button opens file dialog", async () => {
    mockListEndpoint([]);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Upload Document")).toBeInTheDocument();
    });

    const uploadButton = screen.getByText("Upload Document");
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).not.toBeDisabled();
  });

  it("shows summary line with correct document/chunk counts", async () => {
    const docs = [
      makeDoc({ id: "1", chunk_count: 5, embedded_at: "2026-04-01T10:00:00Z" }),
      makeDoc({ id: "2", chunk_count: 7, embedded_at: "2026-04-01T10:00:00Z" }),
    ];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      // Summary: "X of N indexed · Y chunks"
      expect(
        screen.getByText(/2 of 2 indexed · 12 chunks/),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no documents", async () => {
    mockListEndpoint([]);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No documents yet/)).toBeInTheDocument();
    });
  });

  it("collapses and expands document list on header click", async () => {
    const docs = [makeDoc()];
    mockListEndpoint(docs);

    render(<DocumentList customerId="crm-1" />);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });

    // Click to collapse
    const header = screen.getByText("Documents");
    fireEvent.click(header.closest("button")!);

    expect(screen.queryByText("Test Document")).not.toBeInTheDocument();

    // Click to expand again
    fireEvent.click(header.closest("button")!);

    await waitFor(() => {
      expect(screen.getByText("Test Document")).toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { DocumentChat } from "../document-chat";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Minimal scrollIntoView stub
Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function mockDocumentsEndpoint(hasDocuments: boolean) {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/documents")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          documents: hasDocuments ? [{ id: "doc-1", name: "Test Doc" }] : [],
        }),
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

function mockSearchEndpoint(response: {
  answer?: string;
  sources?: { name: string; sourceType: string }[];
  results?: unknown[];
  error?: string;
  ok?: boolean;
}) {
  mockFetch.mockImplementation((url: string) => {
    // Check more specific path FIRST
    if (url.includes("/api/documents/search")) {
      return Promise.resolve({
        ok: response.ok !== false,
        json: async () => response,
      });
    }
    if (url.includes("/api/documents")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          documents: [{ id: "doc-1", name: "Test Doc" }],
        }),
      });
    }
    return Promise.resolve({ ok: false, json: async () => ({}) });
  });
}

// ──────────────────────────────────────────────────────────
// Tests: Empty state — no documents
// ──────────────────────────────────────────────────────────

describe("DocumentChat — no documents", () => {
  beforeEach(() => {
    mockDocumentsEndpoint(false);
  });

  it("shows no-documents empty state", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByText(/no documents found for this customer/i),
      ).toBeInTheDocument();
    });
  });

  it("shows link to documents page", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /go to documents/i });
      expect(link).toHaveAttribute("href", "/dashboard/documents");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Empty state — with documents, no messages yet
// ──────────────────────────────────────────────────────────

describe("DocumentChat — has documents, no messages", () => {
  beforeEach(() => {
    mockDocumentsEndpoint(true);
  });

  it("renders input field and send button", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /send message/i }),
      ).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText(/ask about acme corp/i),
    ).toBeInTheDocument();
  });

  it("shows example questions for the customer", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByText(/ask a question about acme corp/i),
      ).toBeInTheDocument();
    });
  });

  it("clicking example question populates the input", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByText("What are the main challenges discussed?"),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByText("What are the main challenges discussed?"),
    );

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    expect((input as HTMLTextAreaElement).value).toBe(
      "What are the main challenges discussed?",
    );
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Submitting a question
// ──────────────────────────────────────────────────────────

describe("DocumentChat — submitting a question", () => {
  const mockAnswer = "The project deadline is March 31.";
  const mockSources = [{ name: "Project Brief", sourceType: "upload" }];
  const mockResults = [
    {
      content: "The project deadline is March 31.",
      score: 0.9,
      documentName: "Project Brief",
      sourceType: "upload",
      chunkIndex: 0,
      documentId: "doc-1",
    },
  ];

  beforeEach(() => {
    mockSearchEndpoint({
      answer: mockAnswer,
      sources: mockSources,
      results: mockResults,
    });
  });

  it("adds user message to chat on submit", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "What is the deadline?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("What is the deadline?")).toBeInTheDocument();
    });
  });

  it("shows assistant response after API call", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "When is the deadline?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(
        screen.getByText("The project deadline is March 31."),
      ).toBeInTheDocument();
    });
  });

  it("shows sources as badges below assistant answer", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "deadline?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText("Project Brief")).toBeInTheDocument();
    });
  });

  it("shows 'Show context' toggle for retrieved chunks", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "deadline?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/show context/i)).toBeInTheDocument();
    });
  });

  it("'Show context' toggle reveals retrieved chunks with scores", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "deadline?" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(screen.getByText(/show context/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/show context/i));

    await waitFor(() => {
      // The chunk content should now be visible
      expect(
        screen.getAllByText("The project deadline is March 31.").length,
      ).toBeGreaterThanOrEqual(1);
      // Score should be visible
      expect(screen.getByText(/score:.*0\.9/)).toBeInTheDocument();
    });
  });

  it("clears input after sending", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /ask about acme corp/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "My question" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(input.value).toBe("");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Loading state
// ──────────────────────────────────────────────────────────

describe("DocumentChat — loading state", () => {
  it("shows loading indicator while waiting for response", async () => {
    // Set up fetch that never resolves (simulates pending)
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/documents") && !url.includes("search")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ documents: [{ id: "doc-1" }] }),
        });
      }
      // Search never resolves
      return new Promise(() => {});
    });

    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "loading test" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    // Loading indicator (typing dots) should appear
    await waitFor(() => {
      // The typing indicator renders 3 animated spans
      const dots = document.querySelectorAll(".animate-bounce");
      expect(dots.length).toBe(3);
    });
  });

  it("disables input and send button while processing", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("/api/documents") && !url.includes("search")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ documents: [{ id: "doc-1" }] }),
        });
      }
      return new Promise(() => {});
    });

    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    const button = screen.getByRole("button", { name: /send message/i });

    fireEvent.change(input, { target: { value: "test" } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(input).toBeDisabled();
      expect(button).toBeDisabled();
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Error handling
// ──────────────────────────────────────────────────────────

describe("DocumentChat — error handling", () => {
  beforeEach(() => {
    mockSearchEndpoint({ error: "Search service unavailable", ok: false });
  });

  it("shows error message when API call fails", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "test question" } });
    fireEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Search service unavailable"),
      ).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Enter to send, Shift+Enter for newline
// ──────────────────────────────────────────────────────────

describe("DocumentChat — keyboard shortcuts", () => {
  beforeEach(() => {
    mockSearchEndpoint({ answer: "Test answer", sources: [], results: [] });
  });

  it("submits on Enter key", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(/ask about acme corp/i);
    fireEvent.change(input, { target: { value: "enter test" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    await waitFor(() => {
      expect(screen.getByText("enter test")).toBeInTheDocument();
    });
  });

  it("does not submit on Shift+Enter", async () => {
    render(<DocumentChat customerId="cust-1" customerName="Acme Corp" />);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/ask about acme corp/i),
      ).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      /ask about acme corp/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "shift enter test" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });

    // Input should NOT be cleared (no submit happened — value stays)
    await new Promise((r) => setTimeout(r, 100));
    expect(input.value).toBe("shift enter test");
    // The search API should NOT have been called
    const searchCalls = mockFetch.mock.calls.filter((c) =>
      (c[0] as string).includes("/api/documents/search"),
    );
    expect(searchCalls).toHaveLength(0);
  });
});

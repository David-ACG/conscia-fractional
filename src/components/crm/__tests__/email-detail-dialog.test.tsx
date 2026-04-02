import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { EmailDetailDialog } from "../email-detail-dialog";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock DOMPurify
vi.mock("dompurify", () => ({
  default: {
    sanitize: (html: string) => {
      // Strip script tags to simulate sanitisation
      return html.replace(
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        "",
      );
    },
  },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const makeFullDetail = (overrides = {}) => ({
  subject: "Test Subject",
  from: "alice@test.com",
  to: "bob@test.com",
  cc: "charlie@test.com",
  date: "Mon, 01 Jan 2026 10:00:00 +0000",
  body_text: "Hello plain text",
  body_html: "<p>Hello <b>HTML</b></p>",
  attachments: [
    {
      filename: "report.pdf",
      mimeType: "application/pdf",
      size: 12345,
      attachmentId: "att-1",
    },
    {
      filename: "photo.jpg",
      mimeType: "image/jpeg",
      size: 54321,
      attachmentId: "att-2",
    },
  ],
  hasFullAccess: true,
  ...overrides,
});

const makeMetadataDetail = (overrides = {}) => ({
  subject: "Metadata Subject",
  from: "alice@test.com",
  to: "bob@test.com",
  date: "Mon, 01 Jan 2026 10:00:00 +0000",
  snippet: "Just a preview of the email...",
  attachments: [],
  hasFullAccess: false,
  upgradeMessage: "Upgrade to full Gmail access to see email bodies",
  ...overrides,
});

function mockFetchResponse(body: unknown, ok = true) {
  mockFetch.mockResolvedValue({
    ok,
    json: async () => body,
  });
}

const defaultProps = {
  messageId: "msg-1",
  integrationId: "int-1",
  open: true,
  onOpenChange: vi.fn(),
};

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("EmailDetailDialog", () => {
  it("shows loading state while fetching", async () => {
    // Never resolves — stays in loading
    mockFetch.mockReturnValue(new Promise(() => {}));

    render(<EmailDetailDialog {...defaultProps} />);

    expect(screen.getByTestId("email-detail-loading")).toBeInTheDocument();
  });

  it("renders full access email with HTML body and attachments", async () => {
    mockFetchResponse(makeFullDetail());

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Test Subject")).toBeInTheDocument();
    });

    expect(screen.getByText(/alice@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/bob@test.com/)).toBeInTheDocument();
    expect(screen.getByText(/charlie@test.com/)).toBeInTheDocument();
    expect(screen.getByTestId("email-html-body")).toBeInTheDocument();

    // Attachments
    const attachments = screen.getAllByTestId("email-attachment");
    expect(attachments).toHaveLength(2);
    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText("12.1 KB")).toBeInTheDocument();
  });

  it("renders metadata-only view with upgrade message", async () => {
    mockFetchResponse(makeMetadataDetail());

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Metadata Subject")).toBeInTheDocument();
    });

    expect(screen.getByTestId("email-upgrade-message")).toBeInTheDocument();
    expect(
      screen.getByText(/Upgrade to full Gmail access/),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Just a preview of the email..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Go to Settings")).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
  });

  it("renders plain text body when no HTML available", async () => {
    mockFetchResponse(makeFullDetail({ body_html: undefined }));

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByTestId("email-text-body")).toBeInTheDocument();
    });

    expect(screen.getByText("Hello plain text")).toBeInTheDocument();
  });

  it("renders Open in Gmail button with correct link", async () => {
    mockFetchResponse(makeFullDetail());

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Test Subject")).toBeInTheDocument();
    });

    const gmailLink = screen.getByTestId("open-in-gmail-detail");
    expect(gmailLink).toHaveAttribute(
      "href",
      "https://mail.google.com/mail/u/0/#inbox/msg-1",
    );
  });

  it("sanitises HTML body — no script tags", async () => {
    mockFetchResponse(
      makeFullDetail({
        body_html: '<p>Safe</p><script>alert("xss")</script><b>content</b>',
      }),
    );

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      const htmlBody = screen.getByTestId("email-html-body");
      expect(htmlBody.innerHTML).not.toContain("<script>");
      expect(htmlBody.innerHTML).toContain("<p>Safe</p>");
      expect(htmlBody.innerHTML).toContain("<b>content</b>");
    });
  });

  it("shows error state when fetch fails", async () => {
    mockFetchResponse({ error: "Not found" }, false);

    render(<EmailDetailDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });

  it("does not fetch when dialog is closed", () => {
    render(<EmailDetailDialog {...defaultProps} open={false} />);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { EmailTab } from "../email-tab";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const makeIntegration = (overrides = {}) => ({
  id: "int-1",
  account_identifier: "user@gmail.com",
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  id: "msg-1",
  threadId: "thread-1",
  subject: "Hello from Alice",
  from: "alice@acme.com",
  to: "me@conscia.com",
  date: "Mon, 01 Jan 2026 10:00:00 +0000",
  snippet: "Just checking in about the project...",
  ...overrides,
});

function mockFetchSequence(
  responses: { urlFragment: string; body: unknown; ok?: boolean }[],
) {
  mockFetch.mockImplementation((url: string) => {
    const match = responses.find((r) => url.includes(r.urlFragment));
    if (!match) {
      return Promise.resolve({
        ok: false,
        json: async () => ({ error: "not found" }),
      });
    }
    return Promise.resolve({
      ok: match.ok !== false,
      json: async () => match.body,
    });
  });
}

// ──────────────────────────────────────────────────────────
// Tests: No Gmail connected
// ──────────────────────────────────────────────────────────

describe("EmailTab — no Gmail connected", () => {
  beforeEach(() => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: { integrations: [] } },
    ]);
  });

  it("shows empty state with connect message", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(
        screen.getByText("Connect Gmail to see emails"),
      ).toBeInTheDocument();
    });
  });

  it("shows Connect Gmail button linking to settings", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      const link = screen.getByRole("link", { name: /connect gmail/i });
      expect(link).toHaveAttribute("href", "/dashboard/settings");
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: No emails found
// ──────────────────────────────────────────────────────────

describe("EmailTab — Gmail connected, no emails", () => {
  beforeEach(() => {
    mockFetchSequence([
      {
        urlFragment: "gmail/integrations",
        body: { integrations: [makeIntegration()] },
      },
      {
        urlFragment: "gmail/messages",
        body: { messages: [], contactEmails: [], nextPageToken: undefined },
      },
    ]);
  });

  it("shows empty state when no emails returned", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(
        screen.getByText(/no emails found for this customer/i),
      ).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Email list
// ──────────────────────────────────────────────────────────

describe("EmailTab — email list", () => {
  const messages = [
    makeMessage({ id: "msg-1", subject: "First Email" }),
    makeMessage({ id: "msg-2", subject: "Second Email", from: "bob@acme.com" }),
  ];
  const contactEmails = ["alice@acme.com"];

  beforeEach(() => {
    mockFetchSequence([
      {
        urlFragment: "gmail/integrations",
        body: { integrations: [makeIntegration()] },
      },
      {
        urlFragment: "gmail/messages",
        body: { messages, contactEmails, nextPageToken: undefined },
      },
    ]);
  });

  it("renders email subjects", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(screen.getByText("First Email")).toBeInTheDocument();
      expect(screen.getByText("Second Email")).toBeInTheDocument();
    });
  });

  it("renders Open in Gmail links with correct hrefs", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      const links = screen.getAllByTestId("open-in-gmail");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveAttribute(
        "href",
        "https://mail.google.com/mail/u/0/#inbox/msg-1",
      );
      expect(links[1]).toHaveAttribute(
        "href",
        "https://mail.google.com/mail/u/0/#inbox/msg-2",
      );
    });
  });

  it("shows snippet text", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Just checking in about the project..."),
      ).toHaveLength(2);
    });
  });

  it("shows direction indicator: incoming for contact email", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      // alice@acme.com is in contactEmails — should be Incoming
      const incoming = screen.getAllByTestId("direction-incoming");
      expect(incoming.length).toBeGreaterThan(0);
    });
  });

  it("shows direction indicator: outgoing when from is not a contact", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      // bob@acme.com is NOT in contactEmails — should be Outgoing
      const outgoing = screen.getAllByTestId("direction-outgoing");
      expect(outgoing.length).toBeGreaterThan(0);
    });
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Load More pagination
// ──────────────────────────────────────────────────────────

describe("EmailTab — pagination", () => {
  const firstPage = [makeMessage({ id: "msg-1", subject: "Page 1 Email" })];
  const secondPage = [makeMessage({ id: "msg-2", subject: "Page 2 Email" })];

  it("shows Load More button when nextPageToken present", async () => {
    mockFetchSequence([
      {
        urlFragment: "gmail/integrations",
        body: { integrations: [makeIntegration()] },
      },
      {
        urlFragment: "gmail/messages",
        body: {
          messages: firstPage,
          contactEmails: [],
          nextPageToken: "next-token-123",
        },
      },
    ]);

    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /load more/i }),
      ).toBeInTheDocument();
    });
  });

  it("Load More fetches next page and appends results", async () => {
    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.includes("gmail/integrations")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ integrations: [makeIntegration()] }),
        });
      }
      if (url.includes("gmail/messages")) {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              messages: firstPage,
              contactEmails: [],
              nextPageToken: "page-2-token",
            }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            messages: secondPage,
            contactEmails: [],
            nextPageToken: undefined,
          }),
        });
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(screen.getByText("Page 1 Email")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /load more/i }));

    await waitFor(() => {
      expect(screen.getByText("Page 1 Email")).toBeInTheDocument();
      expect(screen.getByText("Page 2 Email")).toBeInTheDocument();
    });

    // Load More button should disappear after last page
    expect(
      screen.queryByRole("button", { name: /load more/i }),
    ).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: Multiple Gmail accounts — integration selector
// ──────────────────────────────────────────────────────────

describe("EmailTab — multiple Gmail accounts", () => {
  const integrations = [
    makeIntegration({ id: "int-1", account_identifier: "work@gmail.com" }),
    makeIntegration({ id: "int-2", account_identifier: "personal@gmail.com" }),
  ];

  beforeEach(() => {
    mockFetchSequence([
      { urlFragment: "gmail/integrations", body: { integrations } },
      {
        urlFragment: "gmail/messages",
        body: { messages: [], contactEmails: [], nextPageToken: undefined },
      },
    ]);
  });

  it("renders account selector when multiple integrations", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      const selector = screen.getByRole("combobox", {
        name: /select gmail account/i,
      });
      expect(selector).toBeInTheDocument();
    });
  });

  it("shows all accounts in selector", async () => {
    render(<EmailTab customerId="customer-1" />);

    await waitFor(() => {
      expect(
        screen.getByRole("option", { name: "work@gmail.com" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("option", { name: "personal@gmail.com" }),
      ).toBeInTheDocument();
    });
  });
});

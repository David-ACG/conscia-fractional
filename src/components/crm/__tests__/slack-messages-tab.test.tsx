import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { SlackMessagesTab } from "../slack-messages-tab";

// --- Mocks ---

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// --- Helpers ---

const makeMapping = (overrides = {}) => ({
  id: "mapping-1",
  channel_id: "C001",
  channel_name: "general",
  crm_customer_id: "customer-1",
  integration_id: "integration-1",
  ...overrides,
});

const makeMessage = (overrides = {}) => ({
  ts: "1700000001.000000",
  user: "U001",
  user_name: "Alice",
  text: "Hello from Slack",
  permalink: "https://slack.com/archives/C001/p1700000001",
  ...overrides,
});

function mockFetchSequence(
  responses: { url: string; body: unknown; ok?: boolean }[],
) {
  mockFetch.mockImplementation((url: string) => {
    const match = responses.find((r) => url.includes(r.url));
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

// --- Tests ---

describe("SlackMessagesTab", () => {
  describe("no channel mapped", () => {
    beforeEach(() => {
      mockFetchSequence([{ url: "mapping/customer", body: null }]);
    });

    it("shows empty state when no channel mapped", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(
          screen.getByText("No Slack channel linked to this customer"),
        ).toBeInTheDocument();
      });
    });

    it("shows link to settings", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        const link = screen.getByRole("link", { name: /Link a channel/i });
        expect(link).toHaveAttribute("href", "/settings");
      });
    });
  });

  describe("channel mapped — messages loaded", () => {
    beforeEach(() => {
      mockFetchSequence([
        { url: "mapping/customer", body: makeMapping() },
        {
          url: "integrations/slack/messages",
          body: [
            makeMessage({
              ts: "1700000002.000000",
              user_name: "Alice",
              text: "Hello world",
            }),
            makeMessage({
              ts: "1700000001.000000",
              user_name: "Bob",
              text: "Second message",
            }),
          ],
        },
      ]);
    });

    it("renders messages from mapped channel", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello world")).toBeInTheDocument();
        expect(screen.getByText("Second message")).toBeInTheDocument();
      });
    });

    it("shows sender names", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
        expect(screen.getByText("Bob")).toBeInTheDocument();
      });
    });

    it("shows channel name in toolbar", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(screen.getByText("#general")).toBeInTheDocument();
      });
    });

    it("renders Open in Slack links with correct href", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        const links = screen.getAllByRole("link", { name: /Open in Slack/i });
        expect(links.length).toBeGreaterThan(0);
        expect(links[0]).toHaveAttribute(
          "href",
          "https://slack.com/archives/C001/p1700000001",
        );
      });
    });
  });

  describe("channel mapped — no messages", () => {
    beforeEach(() => {
      mockFetchSequence([
        { url: "mapping/customer", body: makeMapping() },
        { url: "integrations/slack/messages", body: [] },
      ]);
    });

    it("shows empty state when no messages", async () => {
      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(
          screen.getByText(/No recent messages in #general/),
        ).toBeInTheDocument();
      });
    });
  });

  describe("refresh button", () => {
    it("re-fetches messages when refresh is clicked", async () => {
      mockFetchSequence([
        { url: "mapping/customer", body: makeMapping() },
        { url: "integrations/slack/messages", body: [makeMessage()] },
      ]);

      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        expect(screen.getByText("Hello from Slack")).toBeInTheDocument();
      });

      const refreshButton = screen.getByRole("button", { name: /refresh/i });

      // Update mock to return new message
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("mapping/customer")) {
          return Promise.resolve({ ok: true, json: async () => makeMapping() });
        }
        if (url.includes("integrations/slack/messages")) {
          return Promise.resolve({
            ok: true,
            json: async () => [makeMessage({ text: "Refreshed message" })],
          });
        }
        return Promise.resolve({ ok: false, json: async () => ({}) });
      });

      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(screen.getByText("Refreshed message")).toBeInTheDocument();
      });
    });
  });

  describe("message text rendering", () => {
    it("renders bold Slack markdown", async () => {
      mockFetchSequence([
        { url: "mapping/customer", body: makeMapping() },
        {
          url: "integrations/slack/messages",
          body: [makeMessage({ text: "*bold text*" })],
        },
      ]);

      render(<SlackMessagesTab customerId="customer-1" />);

      await waitFor(() => {
        const bold =
          (screen.getByRole("strong") as HTMLElement | null) ??
          document.querySelector("strong");
        expect(bold?.textContent).toBe("bold text");
      });
    });
  });
});

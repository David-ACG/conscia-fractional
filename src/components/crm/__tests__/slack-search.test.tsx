import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
  act,
} from "@testing-library/react";
import { SlackSearch } from "../slack-search";

// --- Mocks ---

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// --- Helpers ---

const makeSearchResult = (
  overrides: Partial<{
    messages: unknown[];
    total: number;
    page: number;
    has_more: boolean;
  }> = {},
) => ({
  messages: [
    {
      ts: "1700000001.000000",
      user: "U001",
      user_name: "Alice",
      text: "Test message from Alice",
      permalink: "https://slack.com/archives/C001/p1700000001",
      channel_name: "general",
    },
  ],
  total: 1,
  page: 1,
  has_more: false,
  ...overrides,
});

// Trigger a search in real-timer mode: change input, wait for debounce + fetch
async function triggerSearch(input: HTMLElement, query: string) {
  fireEvent.change(input, { target: { value: query } });
  // Wait for the 300ms debounce AND the async fetch to complete
  await waitFor(
    () => {
      expect(mockFetch).toHaveBeenCalled();
    },
    { timeout: 2000 },
  );
}

// --- Tests ---

describe("SlackSearch", () => {
  describe("initial render", () => {
    it("renders search input", () => {
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      expect(
        screen.getByPlaceholderText("Search messages…"),
      ).toBeInTheDocument();
    });

    it("renders scope toggle when channelName is provided", () => {
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      expect(screen.getByLabelText("Search all channels")).toBeInTheDocument();
    });

    it("does not render scope toggle when no channelName", () => {
      render(<SlackSearch integrationId="integration-1" />);
      expect(
        screen.queryByLabelText("Search all channels"),
      ).not.toBeInTheDocument();
    });
  });

  describe("debounced search", () => {
    it("does not fire API call immediately on input", async () => {
      vi.useFakeTimers();
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      fireEvent.change(input, { target: { value: "hello" } });

      expect(mockFetch).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("fires API call after 300ms debounce", async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      fireEvent.change(input, { target: { value: "hello" } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/integrations/slack/search?"),
      );
      vi.useRealTimers();
    });

    it("only fires one API call for rapid typing (debounce batches)", async () => {
      vi.useFakeTimers();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      fireEvent.change(input, { target: { value: "h" } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: "he" } });
      vi.advanceTimersByTime(100);
      fireEvent.change(input, { target: { value: "hello" } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });
  });

  describe("results rendering", () => {
    it("renders sender name in results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });
    });

    it("renders message text in results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      await waitFor(() => {
        expect(screen.getByText("Test message from Alice")).toBeInTheDocument();
      });
    });

    it("renders Open in Slack link with correct href", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      await waitFor(() => {
        const link = screen.getByRole("link", { name: /Open in Slack/i });
        expect(link).toHaveAttribute(
          "href",
          "https://slack.com/archives/C001/p1700000001",
        );
      });
    });
  });

  describe("empty state", () => {
    it("shows empty state when no results", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult({ messages: [], total: 0 }),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "noresults");

      await waitFor(() => {
        expect(screen.getByText(/No results found for/i)).toBeInTheDocument();
      });
    });
  });

  describe("loading state", () => {
    it("shows loading indicator while searching", async () => {
      vi.useFakeTimers();
      // Never resolve so it stays in loading state
      mockFetch.mockReturnValue(new Promise(() => {}));
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");
      fireEvent.change(input, { target: { value: "loading test" } });

      await act(async () => {
        vi.advanceTimersByTime(300);
      });

      const spinner = document.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe("load more", () => {
    it("shows Load more button when has_more is true", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult({ has_more: true, total: 40 }),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "more");

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /Load more/i }),
        ).toBeInTheDocument();
      });
    });

    it("does not show Load more when has_more is false", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult({ has_more: false }),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      await waitFor(() => {
        // Results are shown but no load more
        expect(
          screen.queryByRole("button", { name: /Load more/i }),
        ).not.toBeInTheDocument();
      });
    });

    it("appends results when Load more is clicked", async () => {
      const firstPage = makeSearchResult({
        messages: [
          {
            ts: "1700000001.000000",
            user: "U001",
            user_name: "Alice",
            text: "First page message",
            permalink: "https://slack.com/p/1",
            channel_name: "general",
          },
        ],
        has_more: true,
        page: 1,
        total: 2,
      });

      const secondPage = makeSearchResult({
        messages: [
          {
            ts: "1700000002.000000",
            user: "U002",
            user_name: "Bob",
            text: "Second page message",
            permalink: "https://slack.com/p/2",
            channel_name: "general",
          },
        ],
        has_more: false,
        page: 2,
        total: 2,
      });

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => firstPage })
        .mockResolvedValueOnce({ ok: true, json: async () => secondPage });

      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      await waitFor(() => {
        expect(screen.getByText("First page message")).toBeInTheDocument();
      });

      const loadMoreBtn = screen.getByRole("button", { name: /Load more/i });
      fireEvent.click(loadMoreBtn);

      await waitFor(() => {
        expect(screen.getByText("Second page message")).toBeInTheDocument();
        expect(screen.getByText("First page message")).toBeInTheDocument();
      });
    });
  });

  describe("scope toggle", () => {
    it("includes channel_name param when searching mapped channel", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );
      const input = screen.getByPlaceholderText("Search messages…");

      await triggerSearch(input, "test");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("channel_name=general"),
      );
    });

    it("omits channel_name when searching all channels", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });
      render(
        <SlackSearch integrationId="integration-1" channelName="general" />,
      );

      // Toggle to search all channels
      const toggle = screen.getByLabelText("Search all channels");
      fireEvent.click(toggle);

      // Clear previous calls (toggle re-triggers search if query is already set)
      mockFetch.mockClear();
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => makeSearchResult(),
      });

      const input = screen.getByPlaceholderText("Search messages…");
      await triggerSearch(input, "test");

      const calls = mockFetch.mock.calls;
      const lastCall = calls[calls.length - 1][0] as string;
      expect(lastCall).not.toContain("channel_name=");
    });
  });
});

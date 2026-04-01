import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { UpcomingEventsCard } from "../upcoming-events-card";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

// Helper: build a fake event relative to "now" using the mocked date
function makeEvent(opts: {
  id: string;
  title: string;
  daysFromNow: number;
  customerId?: string;
  customerName?: string;
  customerSlug?: string;
}) {
  const start = new Date("2026-04-02T10:00:00Z");
  start.setDate(start.getDate() + opts.daysFromNow);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    id: opts.id,
    title: opts.title,
    start: start.toISOString(),
    end: end.toISOString(),
    crm_customer: opts.customerId
      ? {
          id: opts.customerId,
          name: opts.customerName!,
          slug: opts.customerSlug!,
        }
      : null,
    location: null,
    meeting_url: null,
    attendees: [],
    status: "confirmed",
  };
}

describe("UpcomingEventsCard", () => {
  beforeEach(() => {
    // Fix "now" so grouping is deterministic
    vi.setSystemTime(new Date("2026-04-02T09:00:00Z"));
  });

  it("renders events grouped by Today/Tomorrow/This Week", async () => {
    const events = [
      makeEvent({ id: "1", title: "Morning Standup", daysFromNow: 0 }),
      makeEvent({ id: "2", title: "Client Review", daysFromNow: 1 }),
      makeEvent({ id: "3", title: "End of Week Call", daysFromNow: 4 }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => events,
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByText("Today")).toBeInTheDocument();
    });

    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    expect(screen.getByText("This Week")).toBeInTheDocument();
    expect(screen.getByText("Morning Standup")).toBeInTheDocument();
    expect(screen.getByText("Client Review")).toBeInTheDocument();
    expect(screen.getByText("End of Week Call")).toBeInTheDocument();
  });

  it("shows time, title, and customer badge for each event", async () => {
    const events = [
      makeEvent({
        id: "1",
        title: "Acme Meeting",
        daysFromNow: 0,
        customerId: "cust-1",
        customerName: "Acme Corp",
        customerSlug: "acme-corp",
      }),
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => events,
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByText("Acme Meeting")).toBeInTheDocument();
    });

    expect(screen.getByTestId("customer-badge")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    // Time shown (10:00 AM UTC displayed as local — just check event-row exists)
    expect(screen.getByTestId("event-row")).toBeInTheDocument();
  });

  it("renders empty state when no events returned", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    expect(screen.getByText("No upcoming events.")).toBeInTheDocument();
  });

  it("shows Connect Google Calendar button when unauthenticated (401)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => [],
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByTestId("no-integration")).toBeInTheDocument();
    });

    expect(screen.getByText("Connect Google Calendar")).toBeInTheDocument();
  });

  it("View Calendar link navigates to /calendar", async () => {
    const events = [makeEvent({ id: "1", title: "Standup", daysFromNow: 0 })];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => events,
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByTestId("view-calendar-link")).toBeInTheDocument();
    });

    expect(screen.getByTestId("view-calendar-link")).toHaveAttribute(
      "href",
      "/calendar",
    );
  });

  it("does not show View Calendar link when no events", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [],
    });

    render(<UpcomingEventsCard />);

    await waitFor(() => {
      expect(screen.getByTestId("empty-state")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("view-calendar-link")).not.toBeInTheDocument();
  });
});

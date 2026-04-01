import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock BroadcastChannel
class MockBroadcastChannel {
  onmessage: ((e: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();
}
vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);

// Mock requestAnimationFrame
vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
  return setTimeout(() => cb(performance.now()), 16) as unknown as number;
});
vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

// Mock client context
vi.mock("@/lib/client-context", () => ({
  useClient: () => ({ clientId: "test-client-id", setClientId: vi.fn() }),
}));

import TimesheetPage from "./page";

describe("TimesheetPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/api/timesheet")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      // Timer API
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({ activeTimer: null, todayTotalMinutes: 0 }),
      });
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the timesheet page with title", () => {
    render(<TimesheetPage />);
    expect(screen.getByText("Timesheet")).toBeInTheDocument();
  });

  it("shows daily, weekly and monthly tabs", () => {
    render(<TimesheetPage />);
    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
  });

  it("has Add Time button", () => {
    render(<TimesheetPage />);
    expect(screen.getByText("Add Time")).toBeInTheDocument();
  });

  it("opens manual entry form when Add Time is clicked", () => {
    render(<TimesheetPage />);
    fireEvent.click(screen.getByText("Add Time"));
    expect(screen.getByText("Add Time Entry")).toBeInTheDocument();
  });

  it("has monthly tab selected by default", () => {
    render(<TimesheetPage />);
    const monthlyTab = screen.getByText("Monthly");
    const dailyTab = screen.getByText("Daily");
    // Monthly tab is selected by default
    expect(monthlyTab.closest("[role='tab']")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Daily tab exists and is not selected
    expect(dailyTab.closest("[role='tab']")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("shows empty state when no entries", async () => {
    render(<TimesheetPage />);
    expect(
      await screen.findByText("No time entries for this period."),
    ).toBeInTheDocument();
  });

  it("shows current month label", () => {
    render(<TimesheetPage />);
    const today = new Date();
    const monthLabel = today.toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    expect(screen.getByText(monthLabel)).toBeInTheDocument();
  });
});

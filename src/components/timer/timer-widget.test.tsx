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

import { TimerProvider } from "./timer-provider";
import { TimerWidget } from "./timer-widget";

function renderWidget() {
  return render(
    <TimerProvider>
      <TimerWidget />
    </TimerProvider>,
  );
}

describe("TimerWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ activeTimer: null, todayTotalMinutes: 0 }),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders in stopped state", () => {
    renderWidget();
    expect(screen.getByLabelText("Start timer")).toBeInTheDocument();
    expect(screen.getByText("00:00:00")).toBeInTheDocument();
    expect(screen.getByText(/Today:/)).toBeInTheDocument();
  });

  it("start button calls startTimer", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ activeTimer: null, todayTotalMinutes: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ activeTimer: { category: "General" } }),
      });

    renderWidget();
    const startBtn = screen.getByLabelText("Start timer");
    fireEvent.click(startBtn);

    // After clicking start, the stop button should appear
    expect(await screen.findByLabelText("Stop timer")).toBeInTheDocument();
  });

  it("category selector opens on category pill click", () => {
    renderWidget();
    const categoryPill = screen.getByText("Category");
    fireEvent.click(categoryPill);
    expect(
      screen.getByPlaceholderText("Search categories..."),
    ).toBeInTheDocument();
  });

  it("fuzzy search filters categories", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({ activeTimer: null, todayTotalMinutes: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            categories: [
              {
                category: "Development",
                count: 5,
                last_used: new Date().toISOString(),
                avg_hour: 10,
                score: 0.8,
              },
              {
                category: "Meetings",
                count: 3,
                last_used: new Date().toISOString(),
                avg_hour: 14,
                score: 0.6,
              },
              {
                category: "Research",
                count: 2,
                last_used: new Date().toISOString(),
                avg_hour: 11,
                score: 0.4,
              },
            ],
          }),
      });

    renderWidget();

    // Open category selector
    const categoryPill = screen.getByText("Category");
    fireEvent.click(categoryPill);

    // Wait for categories to load
    const input = await screen.findByPlaceholderText("Search categories...");

    // Type to filter
    fireEvent.change(input, { target: { value: "Dev" } });

    // Development should still show
    expect(await screen.findByText("Development")).toBeInTheDocument();
  });
});

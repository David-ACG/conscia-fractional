import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { NotificationBell } from "../notification-bell";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Mock date-fns to avoid real time-based output in tests
vi.mock("date-fns", () => ({
  formatDistanceToNow: vi.fn().mockReturnValue("2 minutes ago"),
}));

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function makeNotification(
  overrides: Partial<{
    id: string;
    type: string;
    title: string;
    body: string;
    source_url: string;
    crm_customer_id: string | null;
    is_read: boolean;
    created_at: string;
  }> = {},
) {
  return {
    id: "notif-1",
    type: "new_email",
    title: "New email from alice@acme.com",
    body: "Subject: Project Update",
    source_url: "https://mail.google.com/mail/u/0/#inbox/msg-1",
    crm_customer_id: "customer-1",
    is_read: false,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function mockFetchResponses(
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
// Setup / Teardown
// ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: 0 unread
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ notifications: [], total: 0, unread_count: 0 }),
  });
});

afterEach(() => {
  cleanup();
});

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("NotificationBell", () => {
  it("renders bell icon", async () => {
    render(<NotificationBell />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /notifications/i }),
      ).toBeInTheDocument();
    });
  });

  it("shows badge with unread count when count > 0", async () => {
    mockFetchResponses([
      {
        urlFragment: "/api/notifications",
        body: { notifications: [], total: 0, unread_count: 3 },
      },
    ]);

    render(<NotificationBell />);

    await waitFor(() => {
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("hides badge when unread count is 0", async () => {
    mockFetchResponses([
      {
        urlFragment: "/api/notifications",
        body: { notifications: [], total: 0, unread_count: 0 },
      },
    ]);

    render(<NotificationBell />);

    await waitFor(() => {
      // Wait for fetch to complete
      expect(mockFetch).toHaveBeenCalled();
    });

    // Badge with a number should not be visible
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it("shows notification list in dropdown when opened", async () => {
    const notification = makeNotification({
      title: "New email from bob@acme.com",
    });

    mockFetchResponses([
      {
        urlFragment: "/api/notifications",
        body: { notifications: [notification], total: 1, unread_count: 1 },
      },
    ]);

    render(<NotificationBell />);

    // Open the popover
    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("New email from bob@acme.com"),
      ).toBeInTheDocument();
    });
  });

  it("shows empty state when no notifications", async () => {
    mockFetchResponses([
      {
        urlFragment: "/api/notifications",
        body: { notifications: [], total: 0, unread_count: 0 },
      },
    ]);

    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("No notifications")).toBeInTheDocument();
    });
  });

  it("calls mark-as-read API and navigates to CRM page on notification click", async () => {
    const notification = makeNotification({
      id: "notif-42",
      crm_customer_id: "customer-99",
      is_read: false,
    });

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (
        url.includes("/api/notifications/notif-42") &&
        options?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ ...notification, is_read: true }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          notifications: [notification],
          total: 1,
          unread_count: 1,
        }),
      });
    });

    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(notification.title)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(notification.title));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/notifications/notif-42",
        expect.objectContaining({ method: "PATCH" }),
      );
      expect(mockPush).toHaveBeenCalledWith("/crm/customer-99");
    });
  });

  it("calls mark-all-as-read API when button clicked", async () => {
    const notification = makeNotification({ is_read: false });

    mockFetch.mockImplementation((url: string, options?: RequestInit) => {
      if (
        url.includes("/api/notifications/read-all") &&
        options?.method === "PATCH"
      ) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ updated_count: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({
          notifications: [notification],
          total: 1,
          unread_count: 1,
        }),
      });
    });

    render(<NotificationBell />);

    const button = screen.getByRole("button", { name: /notifications/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Mark all as read")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Mark all as read"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/notifications/read-all",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockCheckNewEmails = vi.fn();
vi.mock("@/lib/services/gmail-sync-service", () => ({
  checkNewEmails: (...args: unknown[]) => mockCheckNewEmails(...args),
  GMAIL_SCOPES: [
    "https://www.googleapis.com/auth/gmail.metadata",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function makeRequest(authHeader?: string) {
  const url = new URL("http://localhost:3002/api/cron/gmail-sync");
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new NextRequest(url, { headers });
}

function makeIntegration(id: string, userId: string) {
  return {
    id,
    user_id: userId,
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    is_active: true,
  };
}

function makeEmailNotification(messageId: string) {
  return {
    subject: `Subject ${messageId}`,
    from: "alice@acme.com",
    date: new Date().toISOString(),
    messageId,
    crmCustomerId: "customer-1",
    crmCustomerName: "Acme",
  };
}

// ──────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");

  // Default: integrations query returns empty list
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ error: null }),
  });

  mockCheckNewEmails.mockResolvedValue([]);
});

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("GET /api/cron/gmail-sync", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header missing Bearer prefix", async () => {
    const req = makeRequest("test-cron-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("creates notifications for new emails and returns correct summary", async () => {
    const integration = makeIntegration("int-1", "user-1");
    const newEmail = makeEmailNotification("msg-1");

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: [integration], error: null }),
        };
      }
      if (table === "notifications") {
        return { insert: mockInsert };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockCheckNewEmails.mockResolvedValue([newEmail]);

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.integrations_checked).toBe(1);
    expect(data.new_emails).toBe(1);
    expect(data.notifications_created).toBe(1);
    expect(data.errors).toHaveLength(0);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        type: "new_email",
        crm_customer_id: "customer-1",
        is_read: false,
      }),
    );
  });

  it("handles multiple integrations", async () => {
    const integrations = [
      makeIntegration("int-1", "user-1"),
      makeIntegration("int-2", "user-2"),
    ];

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: integrations, error: null }),
        };
      }
      if (table === "notifications") {
        return { insert: mockInsert };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockCheckNewEmails
      .mockResolvedValueOnce([makeEmailNotification("msg-1")])
      .mockResolvedValueOnce([
        makeEmailNotification("msg-2"),
        makeEmailNotification("msg-3"),
      ]);

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.integrations_checked).toBe(2);
    expect(data.new_emails).toBe(3);
    expect(data.notifications_created).toBe(3);
  });

  it("continues processing when one integration fails", async () => {
    const integrations = [
      makeIntegration("int-broken", "user-1"),
      makeIntegration("int-ok", "user-2"),
    ];

    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockResolvedValue({ data: integrations, error: null }),
        };
      }
      if (table === "notifications") {
        return { insert: mockInsert };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockCheckNewEmails
      .mockRejectedValueOnce(new Error("Token expired for int-broken"))
      .mockResolvedValueOnce([makeEmailNotification("msg-ok")]);

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.integrations_checked).toBe(2);
    expect(data.new_emails).toBe(1);
    expect(data.notifications_created).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain("int-broken");
  });

  it("returns correct summary when no integrations exist", async () => {
    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../gmail-sync/route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.integrations_checked).toBe(0);
    expect(data.new_emails).toBe(0);
    expect(data.notifications_created).toBe(0);
    expect(data.errors).toHaveLength(0);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────
const mockSyncEvents = vi.fn();
const mockMatchAttendeesToCustomer = vi.fn();
vi.mock("@/lib/services/google-calendar-service", () => ({
  syncEvents: (...args: unknown[]) => mockSyncEvents(...args),
  matchAttendeesToCustomer: (...args: unknown[]) =>
    mockMatchAttendeesToCustomer(...args),
}));

const mockGetValidAccessToken = vi.fn();
const mockCreateOAuth2Client = vi.fn();
vi.mock("@/lib/services/google-auth-service", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  createOAuth2Client: (...args: unknown[]) => mockCreateOAuth2Client(...args),
}));

const mockUpsert = vi.fn();
const mockUpdate = vi.fn();
const mockContains = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

function makeRequest(authHeader?: string) {
  const url = new URL("http://localhost:3002/api/cron/calendar-sync");
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");

  // Default: integrations query returns empty
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect.mockReturnValue(chain);
  chain.eq = mockEq.mockReturnValue(chain);
  chain.contains = mockContains.mockResolvedValue({ data: [], error: null });
  chain.upsert = mockUpsert.mockResolvedValue({ error: null });
  chain.update = mockUpdate.mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null }),
  });

  mockFrom.mockReturnValue(chain);

  // Default auth client mock
  mockCreateOAuth2Client.mockReturnValue({
    setCredentials: vi.fn(),
  });
});

describe("GET /api/cron/calendar-sync", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const { GET } = await import("../route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const { GET } = await import("../route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when Authorization header is missing Bearer prefix", async () => {
    const req = makeRequest("test-cron-secret");
    const { GET } = await import("../route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns empty sync summary when no calendar integrations exist", async () => {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.contains = vi.fn().mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced).toBe(0);
    expect(data.errors).toHaveLength(0);
  });

  it("syncs events for integrations with calendar scope and returns count", async () => {
    const mockIntegration = {
      id: "int-1",
      user_id: "user-1",
      provider: "google",
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      metadata: { calendar_sync_token: "old-token" },
      is_active: true,
    };

    const intChain: Record<string, unknown> = {};
    intChain.select = vi.fn().mockReturnValue(intChain);
    intChain.eq = vi.fn().mockReturnValue(intChain);
    intChain.contains = vi
      .fn()
      .mockResolvedValue({ data: [mockIntegration], error: null });
    intChain.update = vi
      .fn()
      .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const calEventsChain = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return intChain;
      if (table === "calendar_events") return calEventsChain;
      return intChain;
    });

    mockGetValidAccessToken.mockResolvedValue("access-token-123");
    mockSyncEvents.mockResolvedValue({
      events: [
        {
          google_event_id: "ev-1",
          title: "Standup",
          description: null,
          start_time: "2026-04-01T09:00:00Z",
          end_time: "2026-04-01T09:30:00Z",
          location: null,
          meeting_url: null,
          attendees: [
            {
              email: "alice@example.com",
              name: "Alice",
              responseStatus: "accepted",
            },
          ],
          status: "confirmed",
          raw_data: {},
        },
      ],
      nextSyncToken: "new-sync-token",
    });
    mockMatchAttendeesToCustomer.mockResolvedValue("customer-1");

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced).toBe(1);
    expect(data.errors).toHaveLength(0);
    expect(mockSyncEvents).toHaveBeenCalledWith(expect.anything(), "old-token");
    expect(calEventsChain.upsert).toHaveBeenCalledOnce();
  });

  it("continues syncing other integrations when one fails", async () => {
    const integrations = [
      {
        id: "int-broken",
        user_id: "user-1",
        metadata: {},
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      },
      {
        id: "int-ok",
        user_id: "user-2",
        metadata: {},
        scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
      },
    ];

    const intChain: Record<string, unknown> = {};
    intChain.select = vi.fn().mockReturnValue(intChain);
    intChain.eq = vi.fn().mockReturnValue(intChain);
    intChain.contains = vi
      .fn()
      .mockResolvedValue({ data: integrations, error: null });
    intChain.update = vi
      .fn()
      .mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const calEventsChain = {
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return intChain;
      if (table === "calendar_events") return calEventsChain;
      return intChain;
    });

    mockGetValidAccessToken
      .mockRejectedValueOnce(new Error("Token expired for int-broken"))
      .mockResolvedValueOnce("good-token");

    mockSyncEvents.mockResolvedValue({
      events: [
        {
          google_event_id: "ev-ok",
          title: "OK Event",
          description: null,
          start_time: "2026-04-01T10:00:00Z",
          end_time: "2026-04-01T11:00:00Z",
          location: null,
          meeting_url: null,
          attendees: [],
          status: "confirmed",
          raw_data: {},
        },
      ],
      nextSyncToken: "new-token",
    });
    mockMatchAttendeesToCustomer.mockResolvedValue(null);

    const req = makeRequest("Bearer test-cron-secret");
    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.synced).toBe(1);
    expect(data.errors).toHaveLength(1);
    expect(data.errors[0]).toContain("int-broken");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

import { GET, POST, PATCH } from "./route";

const TEST_USER = { id: "user-123", email: "test@example.com" };

describe("Timer API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER } });
  });

  describe("GET /api/timer", () => {
    it("returns null when no active timer", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockGte.mockResolvedValue({ data: [] });
      mockSelect.mockImplementation((fields: string) => {
        if (fields === "*") return { eq: mockEq };
        if (fields === "duration_minutes") return { gte: mockGte };
        return { eq: mockEq };
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await GET();
      const data = await response.json();

      expect(data.activeTimer).toBeNull();
      expect(data.todayTotalMinutes).toBe(0);
    });

    it("returns active timer when one exists", async () => {
      const timer = {
        id: "timer-1",
        user_id: "user-123",
        category: "Development",
        started_at: new Date().toISOString(),
      };
      mockMaybeSingle.mockResolvedValue({ data: timer });
      mockEq.mockReturnValue({ maybeSingle: mockMaybeSingle });
      mockGte.mockResolvedValue({ data: [{ duration_minutes: 30 }] });
      mockSelect.mockImplementation((fields: string) => {
        if (fields === "*") return { eq: mockEq };
        if (fields === "duration_minutes") return { gte: mockGte };
        return { eq: mockEq };
      });
      mockFrom.mockReturnValue({ select: mockSelect });

      const response = await GET();
      const data = await response.json();

      expect(data.activeTimer).toEqual(timer);
      expect(data.todayTotalMinutes).toBe(30);
    });
  });

  describe("POST /api/timer", () => {
    it("creates an active timer", async () => {
      const newTimer = {
        id: "timer-new",
        user_id: "user-123",
        category: "Meetings",
        started_at: new Date().toISOString(),
      };

      mockSingle.mockResolvedValue({ data: newTimer, error: null });
      mockSelect.mockReturnValue({ single: mockSingle });
      mockInsert.mockReturnValue({ select: mockSelect });
      mockEq.mockResolvedValue({});
      mockDelete.mockReturnValue({ eq: mockEq });
      mockFrom.mockImplementation((table: string) => {
        if (table === "active_timer") {
          return { delete: mockDelete, insert: mockInsert };
        }
        return { select: mockSelect };
      });

      const request = new Request("http://localhost/api/timer", {
        method: "POST",
        body: JSON.stringify({ category: "Meetings" }),
        headers: { "Content-Type": "application/json" },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.activeTimer).toEqual(newTimer);
      expect(response.status).toBe(200);
    });
  });

  describe("PATCH /api/timer", () => {
    it("stops timer and creates time entry", async () => {
      const timer = {
        id: "timer-1",
        user_id: "user-123",
        category: "Development",
        client_id: null,
        started_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 min ago
      };

      mockMaybeSingle.mockResolvedValue({ data: timer });
      mockGte.mockResolvedValue({ data: [{ duration_minutes: 60 }] });

      let callCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === "active_timer") {
          callCount++;
          if (callCount === 1) {
            // First call: select to get timer
            return {
              select: () => ({
                eq: () => ({ maybeSingle: mockMaybeSingle }),
              }),
            };
          }
          // Second call: delete
          return { delete: () => ({ eq: () => Promise.resolve({}) }) };
        }
        if (table === "time_entries") {
          return {
            insert: () => Promise.resolve({ error: null }),
            select: () => ({ gte: mockGte }),
          };
        }
        return { select: mockSelect };
      });

      const response = await PATCH();
      const data = await response.json();

      expect(data.stopped).toBe(true);
      expect(typeof data.todayTotalMinutes).toBe("number");
    });
  });
});

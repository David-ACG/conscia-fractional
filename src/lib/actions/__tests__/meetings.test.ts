import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase
const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockNot = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
const mockDelete = vi.fn(() => ({ eq: mockEq }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ select: mockSelect, error: null }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock getActiveClientId
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("Meeting Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ select: mockSelect, error: null });
    mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq });
    mockSingle.mockReturnValue({ data: { id: "meeting-1" }, error: null });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createMeeting", () => {
    it("creates a meeting with valid data", async () => {
      const { createMeeting } = await import("../meetings");
      const result = await createMeeting({
        title: "Sprint Planning",
        meeting_date: "2026-03-27T10:00:00.000Z",
        duration_minutes: 60,
        crm_customer_id: "cust-1",
        attendees: [{ name: "Sana", email: "sana@conscia.ai", role: "CEO" }],
        summary: "Discussed sprint goals",
        transcript: "",
        recording_url: "",
        platform: "zoom",
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true, meetingId: "meeting-1" });
      expect(mockFrom).toHaveBeenCalledWith("meetings");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          title: "Sprint Planning",
          duration_minutes: 60,
          platform: "zoom",
          attendees: [{ name: "Sana", email: "sana@conscia.ai", role: "CEO" }],
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createMeeting } = await import("../meetings");
      const result = await createMeeting({
        title: "",
        meeting_date: "",
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });
  });

  describe("updateMeeting", () => {
    it("updates meeting data", async () => {
      const { updateMeeting } = await import("../meetings");
      const result = await updateMeeting("meeting-1", {
        title: "Updated Sprint Planning",
        meeting_date: "2026-03-27T11:00:00.000Z",
        duration_minutes: 90,
        crm_customer_id: "",
        attendees: [],
        summary: "Updated summary",
        transcript: "",
        recording_url: "",
        platform: "teams",
        is_client_visible: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("meetings");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Sprint Planning",
          duration_minutes: 90,
          platform: "teams",
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "meeting-1");
    });
  });

  describe("deleteMeeting", () => {
    it("removes a meeting", async () => {
      const { deleteMeeting } = await import("../meetings");
      const result = await deleteMeeting("meeting-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("meetings");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "meeting-1");
    });
  });

  describe("logMeetingToTimesheet", () => {
    it("creates a time entry from a meeting", async () => {
      // Reset mocks for this specific test
      mockFrom.mockReset();

      // First call: fetch meeting
      const meetingData = {
        title: "Sprint Planning",
        duration_minutes: 60,
        meeting_date: "2026-03-27T10:00:00.000Z",
        client_id: "client-123",
        crm_customer_id: "cust-1",
      };

      // Track calls to mockFrom
      let callCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockFrom.mockImplementation((table: any) => {
        callCount++;
        if (table === "meetings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: meetingData, error: null })),
              })),
            })),
          };
        }
        // time_entries
        return {
          insert: vi.fn(() => ({ error: null })),
        };
      });

      const { logMeetingToTimesheet } = await import("../meetings");
      const result = await logMeetingToTimesheet("meeting-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("meetings");
      expect(mockFrom).toHaveBeenCalledWith("time_entries");
    });
  });
});

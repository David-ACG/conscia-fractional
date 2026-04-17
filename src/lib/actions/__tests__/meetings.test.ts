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

// Mock SSR Supabase client (used for getting user in embed calls)
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

// Mock auto-embed-service (not testing embedding here)
vi.mock("@/lib/services/auto-embed-service", () => ({
  embedMeeting: vi.fn().mockResolvedValue(undefined),
}));

// Mock transcript extraction service
const mockExtractMeetingData = vi.fn();
vi.mock("@/lib/services/transcript-extraction-service", () => ({
  extractMeetingData: (...args: unknown[]) => mockExtractMeetingData(...args),
}));

// Mock slack notification service
vi.mock("@/lib/services/slack-notification-service", () => ({
  notifyMeetingProcessed: vi.fn().mockResolvedValue(undefined),
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

  describe("reprocessMeetingAction", () => {
    const mockMeeting = {
      id: "meeting-1",
      title: "Processing: test.srt",
      transcript: "00:00:00,000 --> 00:00:05,000 [Speaker 1]\nHello world",
      original_filename: "test.srt",
      client_id: "client-123",
    };

    const mockExtraction = {
      title: "Sprint Planning",
      summary: "## Summary\n- Discussed goals",
      tasks: [
        {
          title: "Deploy to staging",
          description: "Deploy the latest build",
          priority: "high",
          assignee: "David",
          assignee_type: "self",
          confidence: "explicit",
          source_quote: "We need to deploy to staging",
        },
        {
          title: "Update docs",
          description: "Update API documentation",
          priority: "medium",
          assignee: null,
          assignee_type: "client_team",
          confidence: "inferred",
          source_quote: "Someone should update the docs",
        },
      ],
      metadata: {
        durationMinutes: 30,
        speakers: ["Speaker 1"],
        meetingDate: null,
      },
    };

    function setupReprocessMocks(
      meeting = mockMeeting,
      extraction = mockExtraction,
    ) {
      mockExtractMeetingData.mockResolvedValue(extraction);

      const insertedTasks: unknown[] = [];
      const deletedTables: { table: string; field: string; value: string }[] =
        [];
      const updatedData: { table: string; data: unknown }[] = [];

      mockFrom.mockImplementation((table: string) => {
        if (table === "meetings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({ data: meeting, error: null })),
              })),
            })),
            update: vi.fn((data: unknown) => {
              updatedData.push({ table: "meetings", data });
              return {
                eq: vi.fn(() => ({ error: null })),
              };
            }),
          };
        }
        if (table === "tasks") {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn((field: string, value: string) => {
                deletedTables.push({ table: "tasks", field, value });
                return { error: null };
              }),
            })),
            insert: vi.fn((rows: unknown) => {
              if (Array.isArray(rows)) insertedTasks.push(...rows);
              return { error: null };
            }),
          };
        }
        return {
          insert: mockInsert,
          update: mockUpdate,
          delete: mockDelete,
          select: mockSelect,
        };
      });

      return { insertedTasks, deletedTables, updatedData };
    }

    it("creates tasks from extracted action items", async () => {
      const { insertedTasks } = setupReprocessMocks();

      const { reprocessMeetingAction } = await import("../meetings");
      const result = await reprocessMeetingAction("meeting-1");

      expect(result).toEqual({ success: true, title: "Sprint Planning" });
      expect(insertedTasks).toHaveLength(2);
      expect(insertedTasks[0]).toEqual(
        expect.objectContaining({
          title: "Deploy to staging",
          description: "Deploy the latest build",
          priority: "high",
          status: "todo",
          meeting_id: "meeting-1",
          client_id: "client-123",
          assignee: "David",
        }),
      );
      expect(insertedTasks[1]).toEqual(
        expect.objectContaining({
          title: "Update docs",
          priority: "medium",
          assignee: null,
        }),
      );
    });

    it("deletes existing tasks before creating new ones (duplicate prevention)", async () => {
      const { deletedTables, insertedTasks } = setupReprocessMocks();

      const { reprocessMeetingAction } = await import("../meetings");

      // First call
      await reprocessMeetingAction("meeting-1");
      expect(deletedTables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: "tasks",
            field: "meeting_id",
            value: "meeting-1",
          }),
        ]),
      );
      expect(insertedTasks).toHaveLength(2);

      // Second call — same extraction, should still delete then insert
      const tracker2 = setupReprocessMocks();
      await reprocessMeetingAction("meeting-1");
      expect(tracker2.deletedTables).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            table: "tasks",
            field: "meeting_id",
            value: "meeting-1",
          }),
        ]),
      );
      // Should have exactly the extraction count, not doubled
      expect(tracker2.insertedTasks).toHaveLength(2);
    });

    it("links tasks to the meeting via meeting_id", async () => {
      const { insertedTasks } = setupReprocessMocks();

      const { reprocessMeetingAction } = await import("../meetings");
      await reprocessMeetingAction("meeting-1");

      for (const task of insertedTasks) {
        expect(task).toEqual(
          expect.objectContaining({ meeting_id: "meeting-1" }),
        );
      }
    });

    it("updates meeting action_items jsonb field", async () => {
      const { updatedData } = setupReprocessMocks();

      const { reprocessMeetingAction } = await import("../meetings");
      await reprocessMeetingAction("meeting-1");

      const meetingUpdate = updatedData.find((u) => u.table === "meetings");
      expect(meetingUpdate).toBeDefined();
      expect(meetingUpdate!.data).toEqual(
        expect.objectContaining({
          action_items: mockExtraction.tasks,
        }),
      );
    });

    it("handles empty tasks array without errors", async () => {
      const emptyExtraction = {
        ...mockExtraction,
        tasks: [],
      };
      const { insertedTasks } = setupReprocessMocks(
        mockMeeting,
        emptyExtraction,
      );

      const { reprocessMeetingAction } = await import("../meetings");
      const result = await reprocessMeetingAction("meeting-1");

      expect(result).toEqual({ success: true, title: "Sprint Planning" });
      expect(insertedTasks).toHaveLength(0);
    });

    it("returns error when meeting has no transcript", async () => {
      setupReprocessMocks({
        ...mockMeeting,
        transcript: null as unknown as string,
      });

      const { reprocessMeetingAction } = await import("../meetings");
      const result = await reprocessMeetingAction("meeting-1");

      expect(result).toEqual({ error: "Meeting has no transcript to process" });
      expect(mockExtractMeetingData).not.toHaveBeenCalled();
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

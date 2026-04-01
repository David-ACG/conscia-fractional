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
const mockEq = vi.fn().mockReturnThis();
const mockDelete = vi.fn(() => ({ eq: mockEq }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockSingle = vi.fn(() =>
  Promise.resolve({ data: { id: "task-new" }, error: null }),
);
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ error: null, select: mockSelect }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock getActiveClientId
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

// Mock notification service (fire-and-forget, don't let it affect tests)
vi.mock("@/lib/services/slack-notification-service", () => ({
  notifyTaskCreated: vi.fn(() => Promise.resolve()),
  notifyTaskCompleted: vi.fn(() => Promise.resolve()),
}));

describe("Task Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "task-new" }, error: null });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ error: null, select: mockSelect });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createTask", () => {
    it("creates a task with valid data", async () => {
      const { createTask } = await import("../tasks");
      const result = await createTask({
        title: "Test task",
        description: "A test description",
        status: "todo",
        priority: "medium",
        assignee: "David",
        assignee_type: "self",
        due_date: "2026-04-01",
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          title: "Test task",
          priority: "medium",
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createTask } = await import("../tasks");
      const result = await createTask({
        title: "",
        status: "todo",
        priority: "medium",
        assignee_type: "self",
        is_client_visible: false,
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });
  });

  describe("updateTaskStatus", () => {
    it("changes task status", async () => {
      const { updateTaskStatus } = await import("../tasks");
      const result = await updateTaskStatus("task-1", "in_progress");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(mockUpdate).toHaveBeenCalledWith({ status: "in_progress" });
    });

    it("rejects invalid status", async () => {
      const { updateTaskStatus } = await import("../tasks");
      const result = await updateTaskStatus("task-1", "invalid");

      expect(result).toEqual({ error: "Invalid status" });
    });
  });

  describe("deleteTask", () => {
    it("removes a task", async () => {
      const { deleteTask } = await import("../tasks");
      const result = await deleteTask("task-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("tasks");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "task-1");
    });
  });
});

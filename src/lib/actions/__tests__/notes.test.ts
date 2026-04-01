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
const mockInsert = vi.fn(() => ({ error: null }));
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

describe("Note Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createNote", () => {
    it("creates a note with valid data", async () => {
      const { createNote } = await import("../notes");
      const result = await createNote({
        title: "Meeting decision",
        content: "We decided to use Next.js",
        note_type: "decision",
        tags: ["meeting", "tech"],
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("notes");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          title: "Meeting decision",
          note_type: "decision",
          tags: ["meeting", "tech"],
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createNote } = await import("../notes");
      const result = await createNote({
        title: "",
        note_type: "note",
        tags: [],
        is_client_visible: false,
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });
  });

  describe("updateNote", () => {
    it("updates note content", async () => {
      const { updateNote } = await import("../notes");
      const result = await updateNote("note-1", {
        title: "Updated title",
        content: "Updated content",
        note_type: "context",
        tags: ["updated"],
        is_client_visible: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("notes");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated title",
          note_type: "context",
        }),
      );
    });
  });

  describe("deleteNote", () => {
    it("removes a note", async () => {
      const { deleteNote } = await import("../notes");
      const result = await deleteNote("note-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("notes");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "note-1");
    });
  });
});

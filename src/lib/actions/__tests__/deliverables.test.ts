import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
const mockDelete = vi.fn(() => ({ eq: mockEq }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockOrder = vi.fn();
const mockInsert = vi.fn(() => ({ error: null, select: mockSelect }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("Deliverable Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnThis();
    mockInsert.mockReturnValue({ error: null, select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq });
    mockSingle.mockReturnValue({ data: { id: "del-1" }, error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createDeliverable", () => {
    it("creates a deliverable and version 1", async () => {
      // First insert returns the deliverable with id
      mockInsert
        .mockReturnValueOnce({
          error: null,
          select: () => ({
            single: () => ({ data: { id: "del-new" }, error: null }),
          }),
        })
        // Second insert is for the version
        .mockReturnValueOnce({ error: null });

      const { createDeliverable } = await import("../deliverables");
      const result = await createDeliverable({
        name: "Strategy Deck",
        description: "Q1 strategy presentation",
        crm_customer_id: "",
        status: "draft",
        due_date: "2026-04-15",
        file_url: "https://docs.google.com/presentation/123",
        file_name: "strategy-deck.pdf",
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("deliverables");
      expect(mockFrom).toHaveBeenCalledWith("deliverable_versions");
    });
  });

  describe("createNewVersion", () => {
    it("increments version and creates history entry", async () => {
      // First call: from("deliverables").select("version").eq().single()
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            single: () => ({ data: { version: 2 }, error: null }),
          }),
        }),
      });
      // Second call: from("deliverables").update().eq()
      mockFrom.mockReturnValueOnce({
        update: () => ({
          eq: () => ({ error: null }),
        }),
      });
      // Third call: from("deliverable_versions").insert()
      mockFrom.mockReturnValueOnce({
        insert: () => ({ error: null }),
      });

      const { createNewVersion } = await import("../deliverables");
      const result = await createNewVersion("del-1", {
        notes: "Updated charts",
        file_url: "https://docs.google.com/v3",
        file_name: "deck-v3.pdf",
      });

      expect(result).toEqual({ success: true });
      // First call should fetch current version
      expect(mockFrom).toHaveBeenCalledWith("deliverables");
      // Last call should insert into versions
      expect(mockFrom).toHaveBeenCalledWith("deliverable_versions");
    });
  });

  describe("getVersionHistory", () => {
    it("returns versions in descending order", async () => {
      const mockVersions = [
        {
          id: "v3",
          deliverable_id: "del-1",
          version: 3,
          notes: "v3 notes",
          file_url: null,
          file_name: null,
          created_at: "2026-03-27",
        },
        {
          id: "v2",
          deliverable_id: "del-1",
          version: 2,
          notes: "v2 notes",
          file_url: null,
          file_name: null,
          created_at: "2026-03-26",
        },
        {
          id: "v1",
          deliverable_id: "del-1",
          version: 1,
          notes: "Initial version",
          file_url: null,
          file_name: null,
          created_at: "2026-03-25",
        },
      ];

      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            order: () => ({ data: mockVersions }),
          }),
        }),
      });

      const { getVersionHistory } = await import("../deliverables");
      const result = await getVersionHistory("del-1");

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
      expect(result[2].version).toBe(1);
      expect(mockFrom).toHaveBeenCalledWith("deliverable_versions");
    });
  });

  describe("deleteDeliverable", () => {
    it("removes a deliverable (cascade deletes versions)", async () => {
      const { deleteDeliverable } = await import("../deliverables");
      const result = await deleteDeliverable("del-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("deliverables");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "del-1");
    });
  });
});

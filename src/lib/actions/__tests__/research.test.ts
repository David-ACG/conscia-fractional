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
const mockSelect = vi.fn(() => ({
  eq: vi.fn(() => ({
    data: [
      { tags: ["react", "nextjs"] },
      { tags: ["nextjs", "typescript"] },
      { tags: ["react"] },
    ],
  })),
}));
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

describe("Research Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createResearch", () => {
    it("creates a research item with valid data", async () => {
      const { createResearch } = await import("../research");
      const result = await createResearch({
        title: "Architecture Review",
        content: "# Overview\nAnalysis of current system architecture",
        research_type: "architecture",
        tags: ["architecture", "review"],
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("research");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          title: "Architecture Review",
          research_type: "architecture",
          tags: ["architecture", "review"],
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createResearch } = await import("../research");
      const result = await createResearch({
        title: "",
        research_type: "architecture",
        tags: [],
        is_client_visible: false,
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });
  });

  describe("updateResearch", () => {
    it("updates research content", async () => {
      const { updateResearch } = await import("../research");
      const result = await updateResearch("research-1", {
        title: "Updated Research",
        content: "Updated content",
        research_type: "technology",
        tags: ["updated"],
        is_client_visible: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("research");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated Research",
          research_type: "technology",
        }),
      );
    });
  });

  describe("deleteResearch", () => {
    it("removes a research item", async () => {
      const { deleteResearch } = await import("../research");
      const result = await deleteResearch("research-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("research");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "research-1");
    });
  });

  describe("getAllResearchTags", () => {
    it("aggregates unique tags across all research items", async () => {
      const { getAllResearchTags } = await import("../research");
      const tags = await getAllResearchTags("client-123");

      expect(tags).toEqual(["nextjs", "react", "typescript"]);
      expect(mockFrom).toHaveBeenCalledWith("research");
    });
  });
});

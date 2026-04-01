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

vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("Asset Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createAsset", () => {
    it("creates an asset with valid data", async () => {
      const { createAsset } = await import("../assets");
      const result = await createAsset({
        name: "Architecture Diagram",
        description: "System overview",
        asset_type: "diagram",
        file_url: "https://drive.google.com/file/123",
        file_name: "architecture.pdf",
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("assets");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          name: "Architecture Diagram",
          asset_type: "diagram",
          file_url: "https://drive.google.com/file/123",
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createAsset } = await import("../assets");
      const result = await createAsset({
        name: "",
        asset_type: "template",
        is_client_visible: false,
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });
  });

  describe("updateAsset", () => {
    it("updates asset details", async () => {
      const { updateAsset } = await import("../assets");
      const result = await updateAsset("asset-1", {
        name: "Updated Diagram",
        description: "Updated description",
        asset_type: "document",
        file_url: "https://example.com/new",
        file_name: "new-file.pdf",
        is_client_visible: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("assets");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Diagram",
          asset_type: "document",
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "asset-1");
    });
  });

  describe("deleteAsset", () => {
    it("removes an asset", async () => {
      const { deleteAsset } = await import("../assets");
      const result = await deleteAsset("asset-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("assets");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "asset-1");
    });
  });
});

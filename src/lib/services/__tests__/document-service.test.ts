import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Qdrant client
const mockQdrantDelete = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/qdrant-client", () => ({
  getQdrantClient: () => ({ delete: mockQdrantDelete }),
  COLLECTION_NAME: "fractionalbuddy_docs",
}));

// Supabase builder factory — returns a thenable query builder
function makeBuilder(resolveValue: unknown) {
  const builder: Record<string, unknown> = {};

  // All chain methods return the same builder
  const chainMethods = ["select", "eq", "order", "delete", "update", "insert"];
  chainMethods.forEach((method) => {
    builder[method] = vi.fn().mockReturnValue(builder);
  });

  // Make it thenable so `await builder` works
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };

  // .single() returns a promise directly
  builder.single = vi.fn().mockResolvedValue(resolveValue);

  return builder;
}

let mockFromFn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFromFn }),
}));

describe("document-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQdrantDelete.mockResolvedValue(undefined);
  });

  async function getModule() {
    vi.resetModules();
    return await import("../document-service");
  }

  describe("getDocuments", () => {
    it("returns user's documents sorted by created_at DESC", async () => {
      const fakeDocuments = [
        { id: "doc-1", name: "Doc One", created_at: "2026-01-02" },
        { id: "doc-2", name: "Doc Two", created_at: "2026-01-01" },
      ];
      const builder = makeBuilder({ data: fakeDocuments, error: null });
      mockFromFn = vi.fn().mockReturnValue(builder);

      const { getDocuments } = await getModule();
      const result = await getDocuments("user-123");

      expect(mockFromFn).toHaveBeenCalledWith("documents");
      expect(result).toEqual(fakeDocuments);
    });

    it("filters by CRM customer when provided", async () => {
      const builder = makeBuilder({ data: [], error: null });
      const eqSpy = vi.fn().mockReturnValue(builder);
      builder.eq = eqSpy;
      mockFromFn = vi.fn().mockReturnValue(builder);

      const { getDocuments } = await getModule();
      await getDocuments("user-123", "customer-456");

      // Check that eq was called with crm_customer_id
      const calls = eqSpy.mock.calls;
      expect(
        calls.some(
          (c) => c[0] === "crm_customer_id" && c[1] === "customer-456",
        ),
      ).toBe(true);
    });

    it("throws on database error", async () => {
      const builder = makeBuilder({
        data: null,
        error: { message: "DB error" },
      });
      mockFromFn = vi.fn().mockReturnValue(builder);

      const { getDocuments } = await getModule();
      await expect(getDocuments("user-123")).rejects.toThrow("DB error");
    });
  });

  describe("deleteDocument", () => {
    it("removes from both Supabase and Qdrant", async () => {
      // delete().eq().eq() chain
      const innerEq2 = vi.fn().mockResolvedValue({ error: null });
      const innerEq1 = vi.fn().mockReturnValue({ eq: innerEq2 });
      const deleteBuilder = { eq: innerEq1 };
      const fromBuilder = { delete: vi.fn().mockReturnValue(deleteBuilder) };
      mockFromFn = vi.fn().mockReturnValue(fromBuilder);

      const { deleteDocument } = await getModule();
      await deleteDocument("user-123", "doc-abc");

      expect(mockFromFn).toHaveBeenCalledWith("documents");
      expect(mockQdrantDelete).toHaveBeenCalledWith(
        "fractionalbuddy_docs",
        expect.objectContaining({
          filter: {
            must: [{ key: "document_id", match: { value: "doc-abc" } }],
          },
        }),
      );
    });

    it("throws if Supabase delete fails", async () => {
      const innerEq2 = vi
        .fn()
        .mockResolvedValue({ error: { message: "Delete failed" } });
      const innerEq1 = vi.fn().mockReturnValue({ eq: innerEq2 });
      const deleteBuilder = { eq: innerEq1 };
      const fromBuilder = { delete: vi.fn().mockReturnValue(deleteBuilder) };
      mockFromFn = vi.fn().mockReturnValue(fromBuilder);

      const { deleteDocument } = await getModule();
      await expect(deleteDocument("user-123", "doc-abc")).rejects.toThrow(
        "Delete failed",
      );
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCollection = vi.fn();
const mockCreateCollection = vi.fn();

// QdrantClient must be a real constructor function (not arrow fn)
function MockQdrantClient(this: unknown) {
  (this as Record<string, unknown>).getCollection = mockGetCollection;
  (this as Record<string, unknown>).createCollection = mockCreateCollection;
}

vi.mock("@qdrant/js-client-rest", () => ({
  QdrantClient: MockQdrantClient,
}));

describe("qdrant-client", () => {
  beforeEach(() => {
    vi.resetModules();
    mockGetCollection.mockReset();
    mockCreateCollection.mockReset();
  });

  it("getQdrantClient returns a QdrantClient instance", async () => {
    const { getQdrantClient } = await import("../qdrant-client");

    const client = getQdrantClient();
    expect(client).toBeDefined();
    expect(typeof client.getCollection).toBe("function");
  });

  it("getQdrantClient returns singleton (same instance)", async () => {
    const { getQdrantClient } = await import("../qdrant-client");

    const client1 = getQdrantClient();
    const client2 = getQdrantClient();
    expect(client1).toBe(client2);
  });

  it("ensureCollection creates collection when it does not exist", async () => {
    mockGetCollection.mockRejectedValue(new Error("Not found"));
    mockCreateCollection.mockResolvedValue(true);

    const { ensureCollection } = await import("../qdrant-client");
    await ensureCollection("test_collection", 4096);

    expect(mockCreateCollection).toHaveBeenCalledWith("test_collection", {
      vectors: { size: 4096, distance: "Cosine" },
    });
  });

  it("ensureCollection is idempotent when collection exists", async () => {
    mockGetCollection.mockResolvedValue({ status: "green" });

    const { ensureCollection } = await import("../qdrant-client");
    await ensureCollection("test_collection", 4096);

    expect(mockCreateCollection).not.toHaveBeenCalled();
  });

  it("COLLECTION_NAME is fractionalbuddy_docs", async () => {
    const { COLLECTION_NAME } = await import("../qdrant-client");
    expect(COLLECTION_NAME).toBe("fractionalbuddy_docs");
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeEmbeddingResponse(count: number = 1) {
  return {
    ok: true,
    json: async () => ({
      embeddings: Array.from({ length: count }, () =>
        Array.from({ length: 4096 }, () => Math.random()),
      ),
    }),
  };
}

describe("embedding-service", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  async function getModule() {
    return await import("../embedding-service");
  }

  it("embed calls Ollama API with correct model and input", async () => {
    mockFetch.mockResolvedValue(makeEmbeddingResponse());
    const { embed } = await getModule();

    await embed("hello world");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/embed"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "qwen3-embedding:8b",
          input: "hello world",
        }),
      }),
    );
  });

  it("embed returns 4096-dimensional vector", async () => {
    mockFetch.mockResolvedValue(makeEmbeddingResponse());
    const { embed } = await getModule();

    const result = await embed("test");
    expect(result).toHaveLength(4096);
    expect(result.every((v) => typeof v === "number")).toBe(true);
  });

  it("embed retries on failure and succeeds on second attempt", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue(makeEmbeddingResponse());

    const { embed } = await getModule();
    const result = await embed("retry test");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(4096);
  });

  it("embed throws after all retries exhausted", async () => {
    mockFetch.mockRejectedValue(new Error("Permanent failure"));
    const { embed } = await getModule();

    await expect(embed("failing text")).rejects.toThrow(
      /failed after 3 retries/i,
    );
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("embedBatch splits large batches into chunks of 10", async () => {
    // 25 texts → 3 batches: 10, 10, 5
    const texts = Array.from({ length: 25 }, (_, i) => `text ${i}`);
    mockFetch
      .mockResolvedValueOnce(makeEmbeddingResponse(10))
      .mockResolvedValueOnce(makeEmbeddingResponse(10))
      .mockResolvedValueOnce(makeEmbeddingResponse(5));

    const { embedBatch } = await getModule();
    const results = await embedBatch(texts);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(results).toHaveLength(25);
  });

  it("embedBatch returns vectors in correct order", async () => {
    const texts = ["a", "b", "c"];
    // Each embedding is uniquely identifiable by its first element
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: texts.map((_, i) =>
          Array.from({ length: 4096 }, (_, j) => (j === 0 ? i + 1 : 0)),
        ),
      }),
    });

    const { embedBatch } = await getModule();
    const results = await embedBatch(texts);

    expect(results[0][0]).toBe(1);
    expect(results[1][0]).toBe(2);
    expect(results[2][0]).toBe(3);
  });

  it("embedBatch returns empty array for empty input", async () => {
    const { embedBatch } = await getModule();
    const results = await embedBatch([]);
    expect(results).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

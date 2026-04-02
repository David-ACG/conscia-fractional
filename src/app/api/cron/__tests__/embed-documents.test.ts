import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── auto-embed-service mock ────────────────────────────────────────────────────
const mockProcessDocument = vi.fn();

vi.mock("@/lib/services/auto-embed-service", () => ({
  processDocument: mockProcessDocument,
}));

// ── Supabase admin mock ────────────────────────────────────────────────────────
function makeBuilder(resolveValue: unknown) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "update",
    "insert",
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn().mockReturnValue(builder);
  });
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  builder.single = vi.fn().mockResolvedValue(resolveValue);
  return builder;
}

let mockFromFn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFromFn }),
}));

// ── Environment ────────────────────────────────────────────────────────────────
const CRON_SECRET = "test-secret-123";

function makeRequest(secret?: string) {
  const headers: Record<string, string> = {};
  if (secret !== undefined) {
    headers["Authorization"] = `Bearer ${secret}`;
  }
  return new NextRequest("http://localhost/api/cron/embed-documents", {
    headers,
  });
}

describe("cron/embed-documents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
  });

  async function getRoute() {
    return await import("../embed-documents/route");
  }

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await getRoute();
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const { GET } = await getRoute();
    const res = await GET(makeRequest("wrong-secret"));
    expect(res.status).toBe(401);
  });

  it("processes pending documents (embedded_at IS NULL)", async () => {
    const pendingDocs = [
      { id: "doc-1", name: "Doc One", metadata: {} },
      { id: "doc-2", name: "Doc Two", metadata: {} },
    ];
    const pendingBuilder = makeBuilder({ data: pendingDocs, error: null });
    const countBuilder = makeBuilder({ count: 2, error: null });

    let callCount = 0;
    mockFromFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pendingBuilder;
      return countBuilder;
    });

    mockProcessDocument.mockResolvedValue(undefined);

    const { GET } = await getRoute();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = (await res.json()) as {
      processed: number;
      succeeded: number;
      failed: number;
    };

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(2);
    expect(body.failed).toBe(0);
    expect(mockProcessDocument).toHaveBeenCalledTimes(2);
  });

  it("limits to 10 documents per run", async () => {
    // Return 30 documents but expect only 10 to be processed
    const manyDocs = Array.from({ length: 30 }, (_, i) => ({
      id: `doc-${i}`,
      name: `Doc ${i}`,
      metadata: {},
    }));
    const pendingBuilder = makeBuilder({ data: manyDocs, error: null });
    const countBuilder = makeBuilder({ count: 30, error: null });

    let callCount = 0;
    mockFromFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pendingBuilder;
      return countBuilder;
    });

    mockProcessDocument.mockResolvedValue(undefined);

    const { GET } = await getRoute();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = (await res.json()) as { processed: number };

    expect(res.status).toBe(200);
    expect(body.processed).toBeLessThanOrEqual(10);
    expect(mockProcessDocument).toHaveBeenCalledTimes(body.processed);
  });

  it("skips documents with embed_attempts > 3", async () => {
    const docs = [
      { id: "doc-good", name: "Good Doc", metadata: {} },
      {
        id: "doc-bad",
        name: "Bad Doc",
        metadata: { embed_attempts: 3, embed_error: "timeout" },
      },
    ];
    const pendingBuilder = makeBuilder({ data: docs, error: null });
    const countBuilder = makeBuilder({ count: 2, error: null });

    let callCount = 0;
    mockFromFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pendingBuilder;
      return countBuilder;
    });

    mockProcessDocument.mockResolvedValue(undefined);

    const { GET } = await getRoute();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = (await res.json()) as {
      processed: number;
      skipped: number;
    };

    expect(res.status).toBe(200);
    expect(body.skipped).toBe(1);
    expect(mockProcessDocument).toHaveBeenCalledTimes(1);
    expect(mockProcessDocument).toHaveBeenCalledWith("doc-good");
  });

  it("increments embed_attempts on failure", async () => {
    const docs = [
      { id: "doc-fail", name: "Fail Doc", metadata: { embed_attempts: 1 } },
    ];
    const pendingBuilder = makeBuilder({ data: docs, error: null });
    const updateBuilder = makeBuilder({ data: null, error: null });
    const countBuilder = makeBuilder({ count: 1, error: null });

    let callCount = 0;
    mockFromFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pendingBuilder;
      if (callCount === 2) return countBuilder;
      return updateBuilder;
    });

    mockProcessDocument.mockRejectedValue(
      new Error("Ollama connection refused"),
    );

    const { GET } = await getRoute();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = (await res.json()) as { failed: number };

    expect(res.status).toBe(200);
    expect(body.failed).toBe(1);
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          embed_attempts: 2,
          embed_error: "Ollama connection refused",
        }),
      }),
    );
  });

  it("returns correct summary counts", async () => {
    const docs = [
      { id: "doc-1", name: "Good", metadata: {} },
      { id: "doc-2", name: "Fail", metadata: {} },
    ];
    const pendingBuilder = makeBuilder({ data: docs, error: null });
    const updateBuilder = makeBuilder({ data: null, error: null });
    const countBuilder = makeBuilder({ count: 5, error: null });

    let callCount = 0;
    mockFromFn = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return pendingBuilder;
      if (callCount <= 3) return countBuilder;
      return updateBuilder;
    });

    mockProcessDocument
      .mockResolvedValueOnce(undefined) // doc-1 succeeds
      .mockRejectedValueOnce(new Error("fail")); // doc-2 fails

    const { GET } = await getRoute();
    const res = await GET(makeRequest(CRON_SECRET));
    const body = (await res.json()) as {
      processed: number;
      succeeded: number;
      failed: number;
    };

    expect(res.status).toBe(200);
    expect(body.processed).toBe(2);
    expect(body.succeeded).toBe(1);
    expect(body.failed).toBe(1);
  });
});

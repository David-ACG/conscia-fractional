import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockEmbed = vi.fn();
vi.mock("../embedding-service", () => ({
  embed: mockEmbed,
}));

const mockQdrantSearch = vi.fn();
vi.mock("@/lib/qdrant-client", () => ({
  getQdrantClient: () => ({ search: mockQdrantSearch }),
  COLLECTION_NAME: "fractionalbuddy_docs",
}));

const mockMessagesCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class Anthropic {
      messages = { create: mockMessagesCreate };
    },
  };
});

// --- Helpers ---

const QUERY_VECTOR = new Array(4096).fill(0.1);

function makeQdrantResult(
  overrides: Partial<{
    score: number;
    document_id: string;
    chunk_index: number;
    content: string;
    source_type: string;
    crm_customer_id: string;
    user_id: string;
    name: string;
  }> = {},
) {
  const payload = {
    document_id: overrides.document_id ?? "doc-1",
    chunk_index: overrides.chunk_index ?? 0,
    content: overrides.content ?? "Sample content",
    source_type: overrides.source_type ?? "upload",
    crm_customer_id: overrides.crm_customer_id ?? "customer-1",
    user_id: overrides.user_id ?? "user-1",
    name: overrides.name ?? "Test Doc",
  };
  return {
    id: "point-1",
    score: overrides.score ?? 0.9,
    payload,
  };
}

describe("rag-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue(QUERY_VECTOR);
    mockQdrantSearch.mockResolvedValue([]);
  });

  async function getModule() {
    vi.resetModules();
    return await import("../rag-service");
  }

  // ── search ──────────────────────────────────────────────

  describe("search", () => {
    it("embeds the query before searching", async () => {
      const { search } = await getModule();
      await search("what is the status?", { userId: "user-1" });

      expect(mockEmbed).toHaveBeenCalledWith("what is the status?");
    });

    it("searches Qdrant with the embedded vector", async () => {
      const { search } = await getModule();
      await search("status update", { userId: "user-1", limit: 3 });

      expect(mockQdrantSearch).toHaveBeenCalledWith(
        "fractionalbuddy_docs",
        expect.objectContaining({
          vector: QUERY_VECTOR,
          limit: 3,
          with_payload: true,
        }),
      );
    });

    it("always filters by user_id (security test)", async () => {
      const { search } = await getModule();
      await search("query", { userId: "user-abc" });

      const call = mockQdrantSearch.mock.calls[0][1] as {
        filter: { must: Array<{ key: string; match: { value: string } }> };
      };
      const userFilter = call.filter.must.find((f) => f.key === "user_id");
      expect(userFilter).toBeDefined();
      expect(userFilter?.match.value).toBe("user-abc");
    });

    it("never returns other users' data — user_id filter is mandatory", async () => {
      // The filter must include user_id regardless of other options
      const { search } = await getModule();
      await search("query", { userId: "user-123", crmCustomerId: "cust-1" });

      const call = mockQdrantSearch.mock.calls[0][1] as {
        filter: { must: Array<{ key: string; match: { value: string } }> };
      };
      expect(call.filter.must.some((f) => f.key === "user_id")).toBe(true);
    });

    it("adds crm_customer_id filter when provided", async () => {
      const { search } = await getModule();
      await search("query", { userId: "user-1", crmCustomerId: "cust-xyz" });

      const call = mockQdrantSearch.mock.calls[0][1] as {
        filter: { must: Array<{ key: string; match: { value: string } }> };
      };
      const custFilter = call.filter.must.find(
        (f) => f.key === "crm_customer_id",
      );
      expect(custFilter).toBeDefined();
      expect(custFilter?.match.value).toBe("cust-xyz");
    });

    it("does not add crm_customer_id filter when not provided", async () => {
      const { search } = await getModule();
      await search("query", { userId: "user-1" });

      const call = mockQdrantSearch.mock.calls[0][1] as {
        filter: { must: Array<{ key: string; match: { value: string } }> };
      };
      expect(call.filter.must.some((f) => f.key === "crm_customer_id")).toBe(
        false,
      );
    });

    it("returns results sorted by score descending", async () => {
      mockQdrantSearch.mockResolvedValue([
        makeQdrantResult({ score: 0.7, document_id: "doc-low" }),
        makeQdrantResult({ score: 0.95, document_id: "doc-high" }),
        makeQdrantResult({ score: 0.85, document_id: "doc-mid" }),
      ]);

      const { search } = await getModule();
      const results = await search("query", { userId: "user-1" });

      expect(results[0].score).toBe(0.95);
      expect(results[1].score).toBe(0.85);
      expect(results[2].score).toBe(0.7);
    });

    it("maps Qdrant payload to SearchResult fields", async () => {
      mockQdrantSearch.mockResolvedValue([
        makeQdrantResult({
          score: 0.88,
          document_id: "doc-abc",
          chunk_index: 2,
          content: "The project is on track.",
          source_type: "meeting",
          name: "Q1 Meeting",
        }),
      ]);

      const { search } = await getModule();
      const results = await search("query", { userId: "user-1" });

      expect(results[0]).toMatchObject({
        score: 0.88,
        documentId: "doc-abc",
        chunkIndex: 2,
        content: "The project is on track.",
        sourceType: "meeting",
        documentName: "Q1 Meeting",
      });
    });

    it("returns empty array when no matches (not an error)", async () => {
      mockQdrantSearch.mockResolvedValue([]);

      const { search } = await getModule();
      const results = await search("obscure query", { userId: "user-1" });

      expect(results).toEqual([]);
    });

    it("uses default limit of 5 when not specified", async () => {
      const { search } = await getModule();
      await search("query", { userId: "user-1" });

      const call = mockQdrantSearch.mock.calls[0][1] as { limit: number };
      expect(call.limit).toBe(5);
    });
  });

  // ── generateAnswer ──────────────────────────────────────

  describe("generateAnswer", () => {
    const sampleResults = [
      {
        content: "The project deadline is March 31.",
        score: 0.9,
        documentName: "Project Brief",
        sourceType: "upload",
        chunkIndex: 0,
        documentId: "doc-1",
      },
      {
        content: "Budget approved for Q1.",
        score: 0.8,
        documentName: "Budget Doc",
        sourceType: "drive",
        chunkIndex: 1,
        documentId: "doc-2",
      },
    ];

    beforeEach(() => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "The deadline is March 31." }],
      });
    });

    it("formats context with source headers in the prompt", async () => {
      const { generateAnswer } = await getModule();
      await generateAnswer("When is the deadline?", sampleResults);

      const call = mockMessagesCreate.mock.calls[0][0] as {
        messages: Array<{ content: string }>;
      };
      const userContent = call.messages[0].content;

      expect(userContent).toContain("--- Source: Project Brief (upload) ---");
      expect(userContent).toContain("The project deadline is March 31.");
      expect(userContent).toContain("--- Source: Budget Doc (drive) ---");
      expect(userContent).toContain("Budget approved for Q1.");
    });

    it("calls Anthropic SDK with correct model and parameters", async () => {
      const { generateAnswer } = await getModule();
      await generateAnswer("Question?", sampleResults);

      expect(mockMessagesCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
        }),
      );
    });

    it("includes customer name in system prompt when provided", async () => {
      const { generateAnswer } = await getModule();
      await generateAnswer("Question?", sampleResults, {
        crmCustomerName: "Acme Corp",
      });

      const call = mockMessagesCreate.mock.calls[0][0] as { system: string };
      expect(call.system).toContain("Acme Corp");
    });

    it("extracts unique sources from results", async () => {
      const resultsWithDupes = [
        { ...sampleResults[0] },
        { ...sampleResults[0], chunkIndex: 1 }, // same doc, different chunk
        { ...sampleResults[1] },
      ];

      const { generateAnswer } = await getModule();
      const { sources } = await generateAnswer("Query?", resultsWithDupes);

      // Should deduplicate: Project Brief appears twice but should only be once
      const projectBriefSources = sources.filter(
        (s) => s.name === "Project Brief",
      );
      expect(projectBriefSources).toHaveLength(1);
      expect(sources).toHaveLength(2);
    });

    it("returns the answer text from Claude", async () => {
      mockMessagesCreate.mockResolvedValue({
        content: [{ type: "text", text: "The deadline is March 31." }],
      });

      const { generateAnswer } = await getModule();
      const { answer } = await generateAnswer("When?", sampleResults);

      expect(answer).toBe("The deadline is March 31.");
    });
  });
});

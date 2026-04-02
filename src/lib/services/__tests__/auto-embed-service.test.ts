import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Qdrant mock ────────────────────────────────────────────────────────────────
const mockQdrantUpsert = vi.fn().mockResolvedValue(undefined);
const mockQdrantClient = { upsert: mockQdrantUpsert };

vi.mock("@/lib/qdrant-client", () => ({
  getQdrantClient: () => mockQdrantClient,
  ensureCollection: vi.fn().mockResolvedValue(undefined),
  COLLECTION_NAME: "fractionalbuddy_docs",
}));

// ── Embedding service mock ─────────────────────────────────────────────────────
vi.mock("../embedding-service", () => ({
  embedBatch: vi
    .fn()
    .mockResolvedValue([Array(4096).fill(0.1), Array(4096).fill(0.2)]),
}));

// ── Chunking service mock ──────────────────────────────────────────────────────
vi.mock("../chunking-service", () => ({
  chunkDocument: vi.fn().mockReturnValue([
    { index: 0, text: "chunk one", documentId: "doc-1" },
    { index: 1, text: "chunk two", documentId: "doc-1" },
  ]),
}));

// ── Text extraction service mock ──────────────────────────────────────────────
vi.mock("../text-extraction-service", () => ({
  extractText: vi.fn().mockResolvedValue("Extracted text content"),
}));

// ── Google Drive service mock ─────────────────────────────────────────────────
const mockDriveFilesGet = vi.fn();
const mockDriveFilesExport = vi.fn();
const mockDriveClient = {
  files: { get: mockDriveFilesGet, export: mockDriveFilesExport },
};
vi.mock("../google-drive-service", () => ({
  getAuthenticatedDriveClient: vi.fn().mockResolvedValue(mockDriveClient),
}));

// ── Supabase admin mock ────────────────────────────────────────────────────────
function makeBuilder(resolveValue: unknown) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "eq",
    "order",
    "update",
    "insert",
    "is",
    "maybeSingle",
  ];
  chainMethods.forEach((m) => {
    builder[m] = vi.fn().mockReturnValue(builder);
  });
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(resolveValue);
    return Promise.resolve(resolveValue);
  };
  builder.single = vi.fn().mockResolvedValue(resolveValue);
  builder.maybeSingle = vi.fn().mockResolvedValue(resolveValue);
  return builder;
}

let mockFromFn = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFromFn }),
}));

// ── fetch mock ─────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("auto-embed-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQdrantUpsert.mockResolvedValue(undefined);
  });

  async function getModule() {
    vi.resetModules();
    return await import("../auto-embed-service");
  }

  // ── embedMeeting ─────────────────────────────────────────────────────────────
  describe("embedMeeting", () => {
    it("creates document record with correct source_type and source_id", async () => {
      const meetingBuilder = makeBuilder({
        data: {
          id: "meeting-1",
          title: "Weekly Sync",
          meeting_date: "2026-04-01T10:00:00Z",
          transcript: "Alice: Hello\nBob: World",
          crm_customer_id: "crm-1",
        },
        error: null,
      });
      const dupCheckBuilder = makeBuilder({ data: null, error: null });
      const insertBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return meetingBuilder; // fetch meeting
        if (callCount === 2) return dupCheckBuilder; // duplicate check
        return insertBuilder; // insert
      });

      const { embedMeeting } = await getModule();
      await embedMeeting("meeting-1", "user-1");

      // Last call should be the insert
      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-1",
          source_type: "meeting",
          source_id: "meeting-1",
          crm_customer_id: "crm-1",
        }),
      );
    });

    it("skips if meeting already embedded (embedded_at not null)", async () => {
      const meetingBuilder = makeBuilder({
        data: {
          id: "meeting-1",
          title: "Weekly Sync",
          transcript: "some transcript",
          crm_customer_id: null,
        },
        error: null,
      });
      const existingDoc = { id: "doc-1", embedded_at: "2026-04-01T12:00:00Z" };
      const dupBuilder = makeBuilder({ data: existingDoc, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return meetingBuilder;
        return dupBuilder;
      });

      const { embedMeeting } = await getModule();
      await embedMeeting("meeting-1", "user-1");

      // insert should NOT be called
      expect(dupBuilder.insert).not.toHaveBeenCalled();
    });

    it("skips if meeting has no transcript", async () => {
      const meetingBuilder = makeBuilder({
        data: {
          id: "meeting-1",
          title: "Empty",
          transcript: null,
          crm_customer_id: null,
        },
        error: null,
      });
      mockFromFn = vi.fn().mockReturnValue(meetingBuilder);

      const { embedMeeting } = await getModule();
      await embedMeeting("meeting-1", "user-1");

      // Only one from() call for the meeting fetch; no insert
      expect(meetingBuilder.insert).not.toHaveBeenCalled();
    });
  });

  // ── embedDriveFile ────────────────────────────────────────────────────────────
  describe("embedDriveFile", () => {
    it("downloads and queues a Google Docs file as plain text", async () => {
      // No existing duplicate
      const dupBuilder = makeBuilder({ data: null, error: null });
      const insertBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return dupBuilder;
        return insertBuilder;
      });

      // Drive file metadata
      mockDriveFilesGet.mockResolvedValue({
        data: {
          id: "drive-1",
          name: "My Doc",
          mimeType: "application/vnd.google-apps.document",
          size: null,
        },
      });

      // Export response
      mockDriveFilesExport.mockResolvedValue({
        data: Buffer.from("Exported text"),
      });

      const { embedDriveFile } = await getModule();
      await embedDriveFile("drive-1", "user-1", "integration-1", "crm-1");

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: "drive_file",
          source_id: "drive-1",
          user_id: "user-1",
          crm_customer_id: "crm-1",
        }),
      );
    });

    it("skips if drive file already embedded", async () => {
      const existingDoc = { id: "doc-2", embedded_at: "2026-04-01T12:00:00Z" };
      const dupBuilder = makeBuilder({ data: existingDoc, error: null });
      mockFromFn = vi.fn().mockReturnValue(dupBuilder);

      const { embedDriveFile } = await getModule();
      await embedDriveFile("drive-1", "user-1", "integration-1");

      expect(dupBuilder.insert).not.toHaveBeenCalled();
    });
  });

  // ── embedAsset ────────────────────────────────────────────────────────────────
  describe("embedAsset", () => {
    it("downloads from file_url and creates document record", async () => {
      const assetBuilder = makeBuilder({
        data: {
          id: "asset-1",
          name: "Template.txt",
          file_url: "https://example.com/template.txt",
          file_name: "template.txt",
          crm_customer_id: "crm-1",
        },
        error: null,
      });
      const dupBuilder = makeBuilder({ data: null, error: null });
      const insertBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return assetBuilder;
        if (callCount === 2) return dupBuilder;
        return insertBuilder;
      });

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => "text/plain" },
        arrayBuffer: async () => Buffer.from("asset content").buffer,
      });

      const { embedAsset } = await getModule();
      await embedAsset("asset-1", "user-1");

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: "asset",
          source_id: "asset-1",
          user_id: "user-1",
        }),
      );
    });

    it("skips if asset has no file_url", async () => {
      const assetBuilder = makeBuilder({
        data: {
          id: "asset-2",
          name: "NoFile",
          file_url: null,
          crm_customer_id: null,
        },
        error: null,
      });
      mockFromFn = vi.fn().mockReturnValue(assetBuilder);

      const { embedAsset } = await getModule();
      await embedAsset("asset-2", "user-1");

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  // ── embedNote ────────────────────────────────────────────────────────────────
  describe("embedNote", () => {
    it("creates document record for note content", async () => {
      const noteBuilder = makeBuilder({
        data: {
          id: "note-1",
          title: "Strategy Note",
          content: "Key decisions...",
        },
        error: null,
      });
      const dupBuilder = makeBuilder({ data: null, error: null });
      const insertBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return noteBuilder;
        if (callCount === 2) return dupBuilder;
        return insertBuilder;
      });

      const { embedNote } = await getModule();
      await embedNote("note-1", "user-1");

      expect(insertBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_type: "note",
          source_id: "note-1",
          user_id: "user-1",
        }),
      );
    });
  });

  // ── processDocument ──────────────────────────────────────────────────────────
  describe("processDocument", () => {
    it("chunks, embeds, and stores in Qdrant", async () => {
      const docBuilder = makeBuilder({
        data: {
          id: "doc-1",
          name: "Test Doc",
          source_type: "note",
          source_id: "note-1",
          user_id: "user-1",
          crm_customer_id: "crm-1",
          metadata: { content: "Sample content here" },
        },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return docBuilder;
        return updateBuilder;
      });

      const { processDocument } = await getModule();
      await processDocument("doc-1");

      expect(mockQdrantUpsert).toHaveBeenCalledWith(
        "fractionalbuddy_docs",
        expect.objectContaining({ points: expect.any(Array) }),
      );
    });

    it("updates chunk_count and embedded_at after embedding", async () => {
      const docBuilder = makeBuilder({
        data: {
          id: "doc-1",
          name: "Test Doc",
          source_type: "note",
          source_id: "note-1",
          user_id: "user-1",
          crm_customer_id: null,
          metadata: { content: "Content to embed" },
        },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return docBuilder;
        return updateBuilder;
      });

      const { processDocument } = await getModule();
      await processDocument("doc-1");

      expect(updateBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          chunk_count: expect.any(Number),
          embedded_at: expect.any(String),
        }),
      );
    });

    it("cleans up metadata.content after embedding", async () => {
      const docBuilder = makeBuilder({
        data: {
          id: "doc-1",
          name: "Test Doc",
          source_type: "note",
          source_id: "note-1",
          user_id: "user-1",
          crm_customer_id: null,
          metadata: { content: "Some text", meeting_date: "2026-04-01" },
        },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return docBuilder;
        return updateBuilder;
      });

      const { processDocument } = await getModule();
      await processDocument("doc-1");

      const updateArg = (updateBuilder.update as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Record<string, unknown>;
      const updatedMeta = updateArg.metadata as Record<string, unknown>;
      expect(updatedMeta.content).toBeUndefined();
      // Other metadata should be preserved
      expect(updatedMeta.meeting_date).toBe("2026-04-01");
    });

    it("re-fetches transcript for meeting source_type when metadata.content is missing", async () => {
      const docBuilder = makeBuilder({
        data: {
          id: "doc-1",
          name: "Meeting: Sync",
          source_type: "meeting",
          source_id: "meeting-1",
          user_id: "user-1",
          crm_customer_id: null,
          metadata: {},
        },
        error: null,
      });
      const meetingBuilder = makeBuilder({
        data: { transcript: "Alice: Hello everyone" },
        error: null,
      });
      const updateBuilder = makeBuilder({ data: null, error: null });

      let callCount = 0;
      mockFromFn = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) return docBuilder;
        if (callCount === 2) return meetingBuilder;
        return updateBuilder;
      });

      const { processDocument } = await getModule();
      await processDocument("doc-1");

      expect(mockQdrantUpsert).toHaveBeenCalled();
    });
  });
});

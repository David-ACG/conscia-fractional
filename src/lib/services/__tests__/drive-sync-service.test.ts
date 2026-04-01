import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks ---

const mockListFiles = vi.fn();
vi.mock("@/lib/services/google-drive-service", () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

// Chain builder helpers
function makeSelectChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: undefined,
  };
}

function makeQueryChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "in",
    "insert",
    "update",
    "delete",
    "upsert",
    "order",
  ];
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnThis();
  }
  // Make it thenable so await chain resolves
  chain["then"] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolvedValue).then(resolve);
  chain["single"] = vi.fn().mockResolvedValue(resolvedValue);
  return chain;
}

function makeDriveFile(
  overrides: Partial<{
    id: string;
    name: string;
    mimeType: string;
    size: number | null;
    modifiedTime: string;
    webViewLink: string;
    thumbnailLink: string | null;
  }> = {},
) {
  return {
    id: "gf1",
    name: "file.pdf",
    mimeType: "application/pdf",
    size: 1024,
    modifiedTime: "2026-01-01T00:00:00.000Z",
    webViewLink: "https://drive.google.com/view",
    thumbnailLink: null,
    ...overrides,
  };
}

function makeCachedFile(
  overrides: Partial<{
    id: string;
    google_file_id: string;
    modified_at: string | null;
  }> = {},
) {
  return {
    id: "df1",
    google_file_id: "gf1",
    modified_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── syncFolder ────────────────────────────────────────────────────────────────

describe("syncFolder", () => {
  async function setupMocks({
    googleFiles,
    cachedFiles,
    insertError = null,
    updateError = null,
    deleteError = null,
  }: {
    googleFiles: ReturnType<typeof makeDriveFile>[];
    cachedFiles: ReturnType<typeof makeCachedFile>[];
    insertError?: unknown;
    updateError?: unknown;
    deleteError?: unknown;
  }) {
    // listFiles returns all files in one page
    mockListFiles.mockResolvedValue({
      files: googleFiles,
      nextPageToken: null,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders") {
        const chain: Record<string, unknown> = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cdf1",
              integration_id: "int1",
              folder_id: "folder1",
              folder_name: "Test Folder",
            },
            error: null,
          }),
        };
        // Allow .update().eq() to resolve
        (chain.update as ReturnType<typeof vi.fn>).mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        });
        return chain;
      }

      if (table === "drive_files") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: cachedFiles, error: null }),
          insert: vi.fn().mockResolvedValue({ error: insertError }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: updateError }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: deleteError }),
          }),
        };
      }

      return {};
    });
  }

  it("new files: inserts files not in cache and returns correct added count", async () => {
    await setupMocks({
      googleFiles: [
        makeDriveFile({ id: "gf1" }),
        makeDriveFile({ id: "gf2", name: "other.pdf" }),
      ],
      cachedFiles: [],
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.added).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("updated files: detects changed modifiedTime and updates cache", async () => {
    await setupMocks({
      googleFiles: [
        makeDriveFile({ modifiedTime: "2026-02-01T00:00:00.000Z" }),
      ],
      cachedFiles: [
        makeCachedFile({ modified_at: "2026-01-01T00:00:00.000Z" }),
      ],
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.added).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.removed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("removed files: deletes cached files not in Google response", async () => {
    await setupMocks({
      googleFiles: [],
      cachedFiles: [makeCachedFile({ id: "df1", google_file_id: "gf-old" })],
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("mixed changes: handles new, updated, and removed files in one sync", async () => {
    await setupMocks({
      googleFiles: [
        makeDriveFile({
          id: "gf-new",
          name: "new.pdf",
          modifiedTime: "2026-03-01T00:00:00.000Z",
        }),
        makeDriveFile({
          id: "gf-changed",
          name: "changed.pdf",
          modifiedTime: "2026-03-01T00:00:00.000Z",
        }),
      ],
      cachedFiles: [
        // gf-changed exists but with old modified_at
        makeCachedFile({
          id: "df-changed",
          google_file_id: "gf-changed",
          modified_at: "2026-01-01T00:00:00.000Z",
        }),
        // gf-removed only in cache
        makeCachedFile({
          id: "df-removed",
          google_file_id: "gf-removed",
          modified_at: "2026-01-01T00:00:00.000Z",
        }),
      ],
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it("no changes: Google response matches cache exactly, returns all zeros", async () => {
    await setupMocks({
      googleFiles: [
        makeDriveFile({ modifiedTime: "2026-01-01T00:00:00.000Z" }),
      ],
      cachedFiles: [
        makeCachedFile({ modified_at: "2026-01-01T00:00:00.000Z" }),
      ],
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.added).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it("pagination: fetches all pages before comparing", async () => {
    // First call returns page 1 with a nextPageToken, second call returns page 2
    mockListFiles
      .mockResolvedValueOnce({
        files: [makeDriveFile({ id: "gf1" })],
        nextPageToken: "token-page-2",
      })
      .mockResolvedValueOnce({
        files: [makeDriveFile({ id: "gf2", name: "file2.pdf" })],
        nextPageToken: null,
      });

    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cdf1",
              integration_id: "int1",
              folder_id: "folder1",
              folder_name: "TF",
            },
            error: null,
          }),
        };
      }
      if (table === "drive_files") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(mockListFiles).toHaveBeenCalledTimes(2);
    expect(mockListFiles).toHaveBeenNthCalledWith(
      2,
      "int1",
      "folder1",
      "token-page-2",
    );
    expect(result.added).toBe(2);
  });

  it("API error: catches Google API failure and returns it in errors array", async () => {
    mockListFiles.mockRejectedValue(new Error("Auth token expired"));

    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "cdf1",
              integration_id: "int1",
              folder_id: "folder1",
              folder_name: "TF",
            },
            error: null,
          }),
        };
      }
      return {};
    });

    const { syncFolder } = await import("../drive-sync-service");
    const result = await syncFolder("cdf1");

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("Auth token expired");
    expect(result.added).toBe(0);
  });
});

// ─── syncAllFolders ────────────────────────────────────────────────────────────

describe("syncAllFolders", () => {
  it("processes all folders and returns array of results", async () => {
    // Mock admin to return 3 folders (all same integration to avoid delay in tests)
    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders") {
        const callCount = { n: 0 };
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          order: vi.fn().mockReturnThis(),
          // First call (syncAllFolders) returns all 3 folders as array
          // Subsequent calls (syncFolder) return single folder records
          single: vi.fn().mockImplementation(() => {
            callCount.n++;
            const ids = ["cdf1", "cdf2", "cdf3"];
            const idx = (callCount.n - 1) % 3;
            return Promise.resolve({
              data: {
                id: ids[idx],
                integration_id: "int1",
                folder_id: `folder${idx + 1}`,
                folder_name: `Folder ${idx + 1}`,
              },
              error: null,
            });
          }),
          // For the top-level fetchAll (no .single())
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: [
                { id: "cdf1", integration_id: "int1" },
                { id: "cdf2", integration_id: "int1" },
                { id: "cdf3", integration_id: "int1" },
              ],
              error: null,
            }).then(resolve),
        };
      }
      if (table === "drive_files") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    mockListFiles.mockResolvedValue({ files: [], nextPageToken: null });

    const { syncAllFolders } = await import("../drive-sync-service");

    // Patch setTimeout to avoid actual delays in tests
    vi.useFakeTimers();
    const promise = syncAllFolders();
    await vi.runAllTimersAsync();
    const results = await promise;
    vi.useRealTimers();

    expect(results).toHaveLength(3);
  });

  it("groups folders by integration_id for sequential processing", async () => {
    // Two integrations with 1 folder each — no delay needed between different integrations
    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders") {
        return {
          select: vi.fn().mockReturnThis(),
          then: (resolve: (v: unknown) => unknown) =>
            Promise.resolve({
              data: [
                { id: "cdf1", integration_id: "int1" },
                { id: "cdf2", integration_id: "int2" },
              ],
              error: null,
            }).then(resolve),
          eq: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
          single: vi.fn().mockImplementation(() => {
            const calls = mockFrom.mock.calls.filter(
              (c) => c[0] === "crm_drive_folders",
            ).length;
            const id = calls % 2 === 1 ? "cdf1" : "cdf2";
            return Promise.resolve({
              data: {
                id,
                integration_id: `int${calls % 2 === 1 ? 1 : 2}`,
                folder_id: "f1",
                folder_name: "F",
              },
              error: null,
            });
          }),
        };
      }
      if (table === "drive_files") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          insert: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return {};
    });

    mockListFiles.mockResolvedValue({ files: [], nextPageToken: null });

    const { syncAllFolders } = await import("../drive-sync-service");
    const results = await syncAllFolders();

    // Should have processed both folders
    expect(results).toHaveLength(2);
  });
});

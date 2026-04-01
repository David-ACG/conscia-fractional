import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockSyncAllFolders = vi.fn();
vi.mock("@/lib/services/drive-sync-service", () => ({
  syncAllFolders: (...args: unknown[]) => mockSyncAllFolders(...args),
}));

function makeRequest(authHeader?: string) {
  const url = new URL("http://localhost:3002/api/cron/drive-sync");
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) {
    headers["Authorization"] = authHeader;
  }
  return new NextRequest(url, { headers });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("CRON_SECRET", "test-secret");
});

describe("GET /api/cron/drive-sync", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const req = makeRequest();
    const { GET } = await import("../route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 401 when CRON_SECRET is wrong", async () => {
    const req = makeRequest("Bearer wrong-secret");
    const { GET } = await import("../route");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe("Unauthorized");
  });

  it("returns sync summary on success with valid CRON_SECRET", async () => {
    mockSyncAllFolders.mockResolvedValue([
      {
        crmDriveFolderId: "cdf1",
        folderName: "Folder A",
        added: 2,
        updated: 1,
        removed: 0,
        errors: [],
      },
      {
        crmDriveFolderId: "cdf2",
        folderName: "Folder B",
        added: 0,
        updated: 0,
        removed: 1,
        errors: [],
      },
    ]);

    const req = makeRequest("Bearer test-secret");
    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.synced).toBe(2);
    expect(data.totalAdded).toBe(2);
    expect(data.totalUpdated).toBe(1);
    expect(data.totalRemoved).toBe(1);
    expect(data.totalErrors).toBe(0);
    expect(data.results).toHaveLength(2);
    expect(data.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns 500 when syncAllFolders throws unexpectedly", async () => {
    mockSyncAllFolders.mockRejectedValue(
      new Error("Database connection failed"),
    );

    const req = makeRequest("Bearer test-secret");
    const { GET } = await import("../route");
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain("Database connection failed");
  });
});

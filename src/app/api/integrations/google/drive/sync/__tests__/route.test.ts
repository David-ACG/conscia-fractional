import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Mocks ---

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

const mockSyncFolderById = vi.fn();
vi.mock("@/lib/services/drive-sync-service", () => ({
  syncFolderById: (...args: unknown[]) => mockSyncFolderById(...args),
}));

function makeChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

function makeRequest(body: unknown) {
  return new NextRequest(
    new URL("http://localhost:3002/api/integrations/google/drive/sync"),
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/integrations/google/drive/sync", () => {
  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest({ crm_drive_folder_id: "cdf1" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when crm_drive_folder_id is missing", async () => {
    const req = makeRequest({});
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when folder does not exist", async () => {
    const folderChain = makeChain({ data: null });
    mockFrom.mockReturnValue(folderChain);

    const req = makeRequest({ crm_drive_folder_id: "missing" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 403 when integration is not owned by the user", async () => {
    const folderChain = makeChain({
      data: { id: "cdf1", integration_id: "int1" },
    });
    const integrationChain = makeChain({ data: null });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return folderChain;
      return integrationChain;
    });

    const req = makeRequest({ crm_drive_folder_id: "cdf1" });
    const { POST } = await import("../route");
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns sync result on success for authorized user", async () => {
    const folderChain = makeChain({
      data: { id: "cdf1", integration_id: "int1" },
    });
    const integrationChain = makeChain({ data: { id: "int1" } });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return folderChain;
      return integrationChain;
    });

    mockSyncFolderById.mockResolvedValue({
      crmDriveFolderId: "cdf1",
      folderName: "My Folder",
      added: 3,
      updated: 1,
      removed: 0,
      errors: [],
    });

    const req = makeRequest({ crm_drive_folder_id: "cdf1" });
    const { POST } = await import("../route");
    const res = await POST(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.added).toBe(3);
    expect(data.updated).toBe(1);
    expect(data.folderName).toBe("My Folder");
    expect(mockSyncFolderById).toHaveBeenCalledWith("cdf1");
  });
});

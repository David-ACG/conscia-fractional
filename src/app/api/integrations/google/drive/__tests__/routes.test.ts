import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// --- Supabase server client mock ---
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// --- Supabase admin client mock ---
const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

// --- Drive service mocks ---
const mockListFiles = vi.fn();
const mockListFolders = vi.fn();
const mockGetFolderMetadata = vi.fn();
vi.mock("@/lib/services/google-drive-service", () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
  listFolders: (...args: unknown[]) => mockListFolders(...args),
  getFolderMetadata: (...args: unknown[]) => mockGetFolderMetadata(...args),
}));

function makeRequest(url: string, options?: RequestInit) {
  return new NextRequest(new URL(url, "http://localhost:3002"), options);
}

// Chain builder for admin mock queries
function makeChain(result: unknown) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

// ─── GET /api/integrations/google/drive/files ────────────────────────────────

describe("GET /api/integrations/google/drive/files", () => {
  function makeFilesRequest(params: Record<string, string>) {
    const url = new URL(
      "http://localhost:3002/api/integrations/google/drive/files",
    );
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url);
  }

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeFilesRequest({
      folder_id: "f1",
      integration_id: "i1",
      crm_drive_folder_id: "cdf1",
    });

    const { GET } = await import("../files/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required params are missing", async () => {
    const req = makeFilesRequest({ integration_id: "i1" });

    const { GET } = await import("../files/route");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns 404 when integration is not owned by user", async () => {
    const chain = makeChain({ data: null, error: { message: "not found" } });
    chain.single.mockResolvedValue({ data: null });
    mockFrom.mockReturnValue(chain);

    const req = makeFilesRequest({
      folder_id: "f1",
      integration_id: "i1",
      crm_drive_folder_id: "cdf1",
    });

    const { GET } = await import("../files/route");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("caches results in drive_files on success", async () => {
    const chain = makeChain({ data: { id: "i1" } });
    const upsertChain = { upsert: vi.fn().mockResolvedValue({ error: null }) };
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return chain;
      return upsertChain;
    });

    mockListFiles.mockResolvedValue({
      files: [
        {
          id: "gf1",
          name: "file.pdf",
          mimeType: "application/pdf",
          size: 500,
          modifiedTime: "2026-01-01T00:00:00.000Z",
          webViewLink: "https://drive.google.com/view",
          thumbnailLink: null,
          iconLink: null,
        },
      ],
      nextPageToken: null,
    });

    const req = makeFilesRequest({
      folder_id: "f1",
      integration_id: "i1",
      crm_drive_folder_id: "cdf1",
    });

    const { GET } = await import("../files/route");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.files).toHaveLength(1);
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          google_file_id: "gf1",
          crm_drive_folder_id: "cdf1",
        }),
      ]),
      expect.objectContaining({
        onConflict: "crm_drive_folder_id,google_file_id",
      }),
    );
  });
});

// ─── GET /api/integrations/google/drive/folders ──────────────────────────────

describe("GET /api/integrations/google/drive/folders", () => {
  function makeFoldersRequest(params: Record<string, string>) {
    const url = new URL(
      "http://localhost:3002/api/integrations/google/drive/folders",
    );
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return new NextRequest(url);
  }

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeFoldersRequest({ integration_id: "i1" });

    const { GET } = await import("../folders/route");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when integration_id is missing", async () => {
    const req = makeFoldersRequest({});

    const { GET } = await import("../folders/route");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns folder list and null currentFolder for root", async () => {
    const chain = makeChain({ data: { id: "i1" } });
    mockFrom.mockReturnValue(chain);

    mockListFolders.mockResolvedValue([
      {
        id: "folder-a",
        name: "Alpha",
        modifiedTime: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const req = makeFoldersRequest({ integration_id: "i1" });

    const { GET } = await import("../folders/route");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.folders).toHaveLength(1);
    expect(data.currentFolder).toBeNull();
    expect(mockGetFolderMetadata).not.toHaveBeenCalled();
  });

  it("returns currentFolder metadata when parent_id is provided", async () => {
    const chain = makeChain({ data: { id: "i1" } });
    mockFrom.mockReturnValue(chain);

    mockListFolders.mockResolvedValue([]);
    mockGetFolderMetadata.mockResolvedValue({
      id: "p1",
      name: "Parent Folder",
      parents: [],
    });

    const req = makeFoldersRequest({ integration_id: "i1", parent_id: "p1" });

    const { GET } = await import("../folders/route");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.currentFolder).toEqual({ id: "p1", name: "Parent Folder" });
  });
});

// ─── POST /api/integrations/google/drive/link ────────────────────────────────

describe("POST /api/integrations/google/drive/link", () => {
  function makeLinkRequest(body: unknown) {
    return makeRequest(
      "http://localhost:3002/api/integrations/google/drive/link",
      {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeLinkRequest({
      crm_customer_id: "c1",
      integration_id: "i1",
      folder_id: "f1",
      folder_name: "My Folder",
    });

    const { POST } = await import("../link/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = makeLinkRequest({ integration_id: "i1" });

    const { POST } = await import("../link/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates crm_drive_folders record and returns 201", async () => {
    const integrationChain = makeChain({ data: { id: "i1" } });
    const customerChain = makeChain({ data: { id: "c1", client_id: "cl1" } });
    const clientChain = makeChain({ data: { id: "cl1" } });
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: {
          id: "link-1",
          crm_customer_id: "c1",
          integration_id: "i1",
          folder_id: "f1",
          folder_name: "My Folder",
        },
        error: null,
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return integrationChain;
      if (table === "crm_customers") return customerChain;
      if (table === "clients") return clientChain;
      return insertChain;
    });

    const req = makeLinkRequest({
      crm_customer_id: "c1",
      integration_id: "i1",
      folder_id: "f1",
      folder_name: "My Folder",
    });

    const { POST } = await import("../link/route");
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.folder_id).toBe("f1");
  });

  it("returns 409 on duplicate link", async () => {
    const integrationChain = makeChain({ data: { id: "i1" } });
    const customerChain = makeChain({ data: { id: "c1", client_id: "cl1" } });
    const clientChain = makeChain({ data: { id: "cl1" } });
    const insertChain = {
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23505", message: "duplicate key" },
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return integrationChain;
      if (table === "crm_customers") return customerChain;
      if (table === "clients") return clientChain;
      return insertChain;
    });

    const req = makeLinkRequest({
      crm_customer_id: "c1",
      integration_id: "i1",
      folder_id: "f1",
      folder_name: "My Folder",
    });

    const { POST } = await import("../link/route");
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

// ─── DELETE /api/integrations/google/drive/link/[id] ─────────────────────────

describe("DELETE /api/integrations/google/drive/link/[id]", () => {
  function makeDeleteRequest(id: string) {
    return makeRequest(
      `http://localhost:3002/api/integrations/google/drive/link/${id}`,
      {
        method: "DELETE",
      },
    );
  }

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const req = makeDeleteRequest("link-1");

    const { DELETE } = await import("../link/[id]/route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "link-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when folder link does not exist", async () => {
    const folderChain = makeChain({ data: null });
    mockFrom.mockReturnValue(folderChain);

    const req = makeDeleteRequest("missing-id");
    const { DELETE } = await import("../link/[id]/route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "missing-id" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 when integration is not owned by user", async () => {
    const folderChain = makeChain({
      data: { id: "link-1", integration_id: "i1" },
    });
    const integrationChain = makeChain({ data: null });
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return folderChain;
      return integrationChain;
    });

    const req = makeDeleteRequest("link-1");
    const { DELETE } = await import("../link/[id]/route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "link-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("deletes record and returns { success: true }", async () => {
    const folderChain = makeChain({
      data: { id: "link-1", integration_id: "i1" },
    });
    const integrationChain = makeChain({ data: { id: "i1" } });
    const deleteChain = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    let callCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "crm_drive_folders" && callCount === 0) {
        callCount++;
        return folderChain;
      }
      if (table === "integrations") return integrationChain;
      return deleteChain;
    });

    const req = makeDeleteRequest("link-1");
    const { DELETE } = await import("../link/[id]/route");
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "link-1" }),
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
  });
});

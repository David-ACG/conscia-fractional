import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock googleapis
const mockFilesList = vi.fn();
const mockFilesGet = vi.fn();
const mockDriveInstance = {
  files: {
    list: (...args: unknown[]) => mockFilesList(...args),
    get: (...args: unknown[]) => mockFilesGet(...args),
  },
};
vi.mock("googleapis", () => ({
  google: {
    drive: vi.fn(() => mockDriveInstance),
  },
}));

// Mock google-auth-service
const mockGetValidAccessToken = vi.fn();
const mockCreateOAuth2Client = vi.fn();
vi.mock("@/lib/services/google-auth-service", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
  createOAuth2Client: (...args: unknown[]) => mockCreateOAuth2Client(...args),
}));

import {
  listFiles,
  listFolders,
  getFileMetadata,
  GoogleAuthError,
  GoogleDriveNotFoundError,
  GoogleDrivePermissionError,
} from "../google-drive-service";

const mockOAuth2Client = { setCredentials: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidAccessToken.mockResolvedValue("access-token-123");
  mockCreateOAuth2Client.mockReturnValue(mockOAuth2Client);
});

describe("listFiles", () => {
  it("returns correctly formatted files", async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: "file-1",
            name: "Report.docx",
            mimeType:
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size: "1024",
            modifiedTime: "2026-03-01T10:00:00.000Z",
            webViewLink: "https://drive.google.com/file/d/file-1/view",
            thumbnailLink: "https://thumbnail.url",
            iconLink: "https://icon.url",
          },
        ],
        nextPageToken: null,
      },
    });

    const result = await listFiles("integration-1", "folder-1");

    expect(result.files).toHaveLength(1);
    expect(result.files[0]).toEqual({
      id: "file-1",
      name: "Report.docx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      size: 1024,
      modifiedTime: "2026-03-01T10:00:00.000Z",
      webViewLink: "https://drive.google.com/file/d/file-1/view",
      thumbnailLink: "https://thumbnail.url",
      iconLink: "https://icon.url",
    });
    expect(result.nextPageToken).toBeNull();
  });

  it("handles null size as null (not 0)", async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: "file-2",
            name: "Doc.gdoc",
            mimeType: "application/vnd.google-apps.document",
            size: null,
            modifiedTime: "2026-03-01T10:00:00.000Z",
            webViewLink: "https://drive.google.com/file/d/file-2/view",
            thumbnailLink: null,
            iconLink: null,
          },
        ],
        nextPageToken: null,
      },
    });

    const result = await listFiles("integration-1", "folder-1");
    expect(result.files[0].size).toBeNull();
  });

  it("handles pagination with pageToken", async () => {
    mockFilesList.mockResolvedValue({
      data: { files: [], nextPageToken: "next-page-token" },
    });

    const result = await listFiles(
      "integration-1",
      "folder-1",
      "prev-page-token",
    );

    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: "prev-page-token" }),
    );
    expect(result.nextPageToken).toBe("next-page-token");
  });

  it("returns nextPageToken when more pages exist", async () => {
    mockFilesList.mockResolvedValue({
      data: { files: [], nextPageToken: "token-xyz" },
    });

    const result = await listFiles("integration-1", "folder-1");
    expect(result.nextPageToken).toBe("token-xyz");
  });

  it("throws GoogleAuthError on 401", async () => {
    mockFilesList.mockRejectedValue({ code: 401, message: "Unauthorized" });

    await expect(listFiles("integration-1", "folder-1")).rejects.toThrow(
      GoogleAuthError,
    );
  });

  it("throws GoogleDriveNotFoundError on 404", async () => {
    mockFilesList.mockRejectedValue({ code: 404, message: "Not Found" });

    await expect(listFiles("integration-1", "folder-1")).rejects.toThrow(
      GoogleDriveNotFoundError,
    );
  });

  it("throws GoogleDrivePermissionError on 403", async () => {
    mockFilesList.mockRejectedValue({ code: 403, message: "Forbidden" });

    await expect(listFiles("integration-1", "folder-1")).rejects.toThrow(
      GoogleDrivePermissionError,
    );
  });
});

describe("listFolders", () => {
  it("returns folders sorted by name", async () => {
    mockFilesList.mockResolvedValue({
      data: {
        files: [
          {
            id: "folder-a",
            name: "Alpha",
            modifiedTime: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "folder-b",
            name: "Beta",
            modifiedTime: "2026-01-02T00:00:00.000Z",
          },
        ],
      },
    });

    const result = await listFolders("integration-1", "parent-folder");

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Alpha");
    expect(result[1].name).toBe("Beta");
  });

  it("uses 'root' as default parent when parentId is not provided", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });

    await listFolders("integration-1");

    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("'root' in parents"),
      }),
    );
  });

  it("uses provided parentId in query", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });

    await listFolders("integration-1", "specific-parent");

    expect(mockFilesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: expect.stringContaining("'specific-parent' in parents"),
      }),
    );
  });

  it("returns empty array when no folders exist", async () => {
    mockFilesList.mockResolvedValue({ data: { files: [] } });

    const result = await listFolders("integration-1");
    expect(result).toEqual([]);
  });
});

describe("getFileMetadata", () => {
  it("returns single file metadata", async () => {
    mockFilesGet.mockResolvedValue({
      data: {
        id: "file-xyz",
        name: "Presentation.pptx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: "2048",
        modifiedTime: "2026-02-15T08:30:00.000Z",
        webViewLink: "https://drive.google.com/file/d/file-xyz/view",
        thumbnailLink: null,
        iconLink: "https://icon.url",
      },
    });

    const result = await getFileMetadata("integration-1", "file-xyz");

    expect(result.id).toBe("file-xyz");
    expect(result.name).toBe("Presentation.pptx");
    expect(result.size).toBe(2048);
  });

  it("throws GoogleDriveNotFoundError when file does not exist", async () => {
    mockFilesGet.mockRejectedValue({ code: 404, message: "Not Found" });

    await expect(
      getFileMetadata("integration-1", "missing-file"),
    ).rejects.toThrow(GoogleDriveNotFoundError);
  });

  it("throws GoogleDrivePermissionError on 403", async () => {
    mockFilesGet.mockRejectedValue({ code: 403, message: "Forbidden" });

    await expect(
      getFileMetadata("integration-1", "private-file"),
    ).rejects.toThrow(GoogleDrivePermissionError);
  });
});

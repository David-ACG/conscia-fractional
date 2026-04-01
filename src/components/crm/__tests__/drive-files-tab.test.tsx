import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { DriveFilesTab, getFileIcon, formatFileSize } from "../drive-files-tab";
import {
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
} from "lucide-react";

// --- Mocks ---

vi.mock("@/lib/actions/drive", () => ({
  getLinkedFolders: vi.fn(),
  unlinkFolder: vi.fn(),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getLinkedFolders } from "@/lib/actions/drive";

const mockGetLinkedFolders = vi.mocked(getLinkedFolders);

const makeFolder = (overrides = {}) => ({
  id: "folder-1",
  crm_customer_id: "customer-1",
  integration_id: "integration-1",
  folder_id: "drive-folder-abc",
  folder_name: "LoveSac Shared",
  created_at: new Date().toISOString(),
  integrations: { account_identifier: "david@gwth.ai" },
  ...overrides,
});

const makeFile = (overrides = {}) => ({
  id: "file-1",
  name: "solution-design.docx",
  mimeType:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  size: 2500000,
  modifiedTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  webViewLink: "https://docs.google.com/file/1",
  ...overrides,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("getFileIcon", () => {
  it("returns FileText for pdf", () => {
    expect(getFileIcon("application/pdf")).toBe(FileText);
  });

  it("returns FileText for google doc", () => {
    expect(getFileIcon("application/vnd.google-apps.document")).toBe(FileText);
  });

  it("returns FileSpreadsheet for google spreadsheet", () => {
    expect(getFileIcon("application/vnd.google-apps.spreadsheet")).toBe(
      FileSpreadsheet,
    );
  });

  it("returns FileSpreadsheet for xlsx", () => {
    expect(
      getFileIcon(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ),
    ).toBe(FileSpreadsheet);
  });

  it("returns FileImage for image types", () => {
    expect(getFileIcon("image/png")).toBe(FileImage);
    expect(getFileIcon("image/jpeg")).toBe(FileImage);
  });

  it("returns FileVideo for video types", () => {
    expect(getFileIcon("video/mp4")).toBe(FileVideo);
  });

  it("returns File for unknown types", () => {
    expect(getFileIcon("application/unknown")).toBe(File);
    expect(getFileIcon("")).toBe(File);
  });
});

describe("formatFileSize", () => {
  it("returns — for null/undefined", () => {
    expect(formatFileSize(null)).toBe("—");
    expect(formatFileSize(undefined)).toBe("—");
    expect(formatFileSize(0)).toBe("—");
  });

  it("formats bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats KB", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });

  it("formats MB", () => {
    expect(formatFileSize(2.4 * 1024 * 1024)).toBe("2.4 MB");
  });

  it("formats GB", () => {
    expect(formatFileSize(1.2 * 1024 * 1024 * 1024)).toBe("1.2 GB");
  });

  it("handles string bytes", () => {
    expect(formatFileSize("1048576")).toBe("1.0 MB");
  });
});

describe("DriveFilesTab", () => {
  describe("empty state — no folders linked", () => {
    beforeEach(() => {
      mockGetLinkedFolders.mockResolvedValue([]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ files: [] }),
      });
    });

    it("shows empty state when no folders linked", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(
          screen.getByText("No Google Drive folders linked"),
        ).toBeInTheDocument();
      });
    });

    it("shows Link Google Drive Folder button", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Link Google Drive Folder"),
        ).toBeInTheDocument();
      });
    });

    it("shows Go to Settings link when no accounts connected", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByTestId("go-to-settings")).toBeInTheDocument();
      });
    });

    it("shows customer name in empty state message", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="Conscia" />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Conscia/)).toBeInTheDocument();
      });
    });
  });

  describe("folders linked — file list", () => {
    beforeEach(() => {
      mockGetLinkedFolders.mockResolvedValue([makeFolder()]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            makeFile({ id: "f1", name: "solution-design.docx", size: 2500000 }),
            makeFile({
              id: "f2",
              name: "requirements.xlsx",
              mimeType:
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              size: 1100000,
            }),
          ],
          nextPageToken: null,
        }),
      });
    });

    it("renders file list when folder is linked", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("solution-design.docx")).toBeInTheDocument();
        expect(screen.getByText("requirements.xlsx")).toBeInTheDocument();
      });
    });

    it("shows human-readable file sizes", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("2.4 MB")).toBeInTheDocument();
        expect(screen.getByText("1.0 MB")).toBeInTheDocument();
      });
    });

    it("shows folder name in toolbar", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("LoveSac Shared")).toBeInTheDocument();
      });
    });

    it("shows account email", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("david@gwth.ai")).toBeInTheDocument();
      });
    });
  });

  describe("sort toggle", () => {
    beforeEach(() => {
      mockGetLinkedFolders.mockResolvedValue([makeFolder()]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [
            makeFile({
              id: "f1",
              name: "Zeta.docx",
              modifiedTime: new Date(Date.now() - 1000).toISOString(),
            }),
            makeFile({
              id: "f2",
              name: "Alpha.docx",
              modifiedTime: new Date(Date.now() - 2000).toISOString(),
            }),
          ],
        }),
      });
    });

    it("clicking Name header sorts by name", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Zeta.docx")).toBeInTheDocument();
      });

      const nameHeader = screen.getByText(/^Name/);
      fireEvent.click(nameHeader);

      const rows = screen.getAllByRole("row").slice(1); // skip header
      expect(rows[0]).toHaveTextContent("Alpha.docx");
      expect(rows[1]).toHaveTextContent("Zeta.docx");
    });

    it("clicking Name twice reverses sort direction", async () => {
      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Zeta.docx")).toBeInTheDocument();
      });

      const nameHeader = screen.getByText(/^Name/);
      fireEvent.click(nameHeader);
      fireEvent.click(nameHeader);

      const rows = screen.getAllByRole("row").slice(1);
      expect(rows[0]).toHaveTextContent("Zeta.docx");
      expect(rows[1]).toHaveTextContent("Alpha.docx");
    });
  });

  describe("Load More button", () => {
    it("shows Load More when nextPageToken exists", async () => {
      mockGetLinkedFolders.mockResolvedValue([makeFolder()]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [makeFile()],
          nextPageToken: "token-abc",
        }),
      });

      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.getByText("Load More")).toBeInTheDocument();
      });
    });

    it("does not show Load More when nextPageToken is absent", async () => {
      mockGetLinkedFolders.mockResolvedValue([makeFolder()]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          files: [makeFile()],
        }),
      });

      render(
        <DriveFilesTab crmCustomerId="customer-1" crmCustomerName="LoveSac" />,
      );

      await waitFor(() => {
        expect(screen.queryByText("Load More")).not.toBeInTheDocument();
      });
    });
  });
});

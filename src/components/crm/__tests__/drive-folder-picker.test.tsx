import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";
import { DriveFolderPicker } from "../drive-folder-picker";

// --- Mocks ---

vi.mock("@/lib/actions/integrations", () => ({
  getGoogleIntegrations: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getGoogleIntegrations } from "@/lib/actions/integrations";
const mockGetGoogleIntegrations = vi.mocked(getGoogleIntegrations);

const makeIntegration = (overrides = {}) => ({
  id: "integration-1",
  account_identifier: "david@gwth.ai",
  provider: "google",
  ...overrides,
});

const makeFolder = (id: string, name: string) => ({ id, name });

const defaultProps = {
  crmCustomerId: "customer-1",
  open: true,
  onOpenChange: vi.fn(),
  onFolderLinked: vi.fn(),
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("DriveFolderPicker", () => {
  describe("no Google accounts connected", () => {
    beforeEach(() => {
      mockGetGoogleIntegrations.mockResolvedValue([]);
    });

    it("shows connect message when no accounts connected", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText(/No Google accounts connected/),
        ).toBeInTheDocument();
      });
    });

    it("shows Connect one in Settings link", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Connect one in Settings")).toBeInTheDocument();
      });
    });
  });

  describe("single account — folder list", () => {
    beforeEach(() => {
      mockGetGoogleIntegrations.mockResolvedValue([makeIntegration()]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          folders: [
            makeFolder("folder-1", "LoveSac Shared"),
            makeFolder("folder-2", "Holt Renfrew"),
          ],
          currentFolder: null,
        }),
      });
    });

    it("shows account identifier", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/david@gwth\.ai/)).toBeInTheDocument();
      });
    });

    it("shows folders list", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("LoveSac Shared")).toBeInTheDocument();
        expect(screen.getByText("Holt Renfrew")).toBeInTheDocument();
      });
    });

    it("shows My Drive breadcrumb at root", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("My Drive")).toBeInTheDocument();
      });
    });

    it("clicking a folder navigates into it and updates breadcrumb", async () => {
      // Second fetch returns subfolders of LoveSac Shared
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            folders: [
              makeFolder("folder-1", "LoveSac Shared"),
              makeFolder("folder-2", "Holt Renfrew"),
            ],
            currentFolder: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            folders: [makeFolder("sub-1", "Meeting Notes")],
            currentFolder: { id: "folder-1", name: "LoveSac Shared" },
          }),
        });

      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("LoveSac Shared")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("LoveSac Shared"));

      await waitFor(() => {
        // Breadcrumb should now show LoveSac Shared
        expect(screen.getAllByText("LoveSac Shared").length).toBeGreaterThan(0);
        expect(screen.getByText("Meeting Notes")).toBeInTheDocument();
      });
    });

    it("shows empty folder message when no subfolders", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ folders: [], currentFolder: null }),
      });

      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(
          screen.getByText("This folder has no subfolders."),
        ).toBeInTheDocument();
      });
    });

    it("Select button shows current folder name", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Select "My Drive"/)).toBeInTheDocument();
      });
    });

    it("clicking Select button calls link API and triggers onFolderLinked", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            folders: [makeFolder("folder-1", "LoveSac Shared")],
            currentFolder: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: "link-1" }),
        });

      const onFolderLinked = vi.fn();
      const onOpenChange = vi.fn();

      render(
        <DriveFolderPicker
          {...defaultProps}
          onFolderLinked={onFolderLinked}
          onOpenChange={onOpenChange}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/Select "My Drive"/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Select "My Drive"/));

      await waitFor(() => {
        expect(onFolderLinked).toHaveBeenCalledTimes(1);
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("shows error when link API fails", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            folders: [],
            currentFolder: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: async () => ({ error: "Folder already linked" }),
        });

      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Select "My Drive"/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Select "My Drive"/));

      await waitFor(() => {
        expect(screen.getByText("Folder already linked")).toBeInTheDocument();
      });
    });
  });

  describe("account selector", () => {
    it("shows account selector when multiple accounts connected", async () => {
      mockGetGoogleIntegrations.mockResolvedValue([
        makeIntegration({ id: "i1", account_identifier: "david@gwth.ai" }),
        makeIntegration({ id: "i2", account_identifier: "work@conscia.com" }),
      ]);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ folders: [], currentFolder: null }),
      });

      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Account")).toBeInTheDocument();
      });
    });
  });

  describe("error state", () => {
    beforeEach(() => {
      mockGetGoogleIntegrations.mockResolvedValue([makeIntegration()]);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Failed to load folders" }),
      });
    });

    it("shows error message when folder API fails", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to load folders/)).toBeInTheDocument();
      });
    });

    it("shows Retry button in error state", async () => {
      render(<DriveFolderPicker {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeInTheDocument();
      });
    });
  });
});

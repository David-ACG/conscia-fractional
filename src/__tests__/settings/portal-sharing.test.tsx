import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from "@testing-library/react";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockUpdatePortalSetting = vi.fn();
const mockInvitePortalUser = vi.fn();
const mockRevokePortalUser = vi.fn();

vi.mock("@/lib/actions/portal", () => ({
  updatePortalSetting: (...args: unknown[]) => mockUpdatePortalSetting(...args),
  invitePortalUser: (...args: unknown[]) => mockInvitePortalUser(...args),
  revokePortalUser: (...args: unknown[]) => mockRevokePortalUser(...args),
}));

import { toast } from "sonner";
import { PortalSharingSettings } from "@/components/settings/portal-sharing-settings";
import type { PortalSettings, PortalInvitation } from "@/lib/types";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────

const CLIENT_ID = "client-1";

function makeSettings(
  overrides?: Partial<Record<string, boolean>>,
): PortalSettings[] {
  const modules = [
    "timesheet",
    "tasks",
    "meetings",
    "deliverables",
    "invoicing",
    "notes",
    "research",
  ];
  return modules.map((mod) => ({
    id: `setting-${mod}`,
    client_id: CLIENT_ID,
    module: mod,
    is_enabled: overrides?.[mod] ?? false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  }));
}

function makeInvitation(
  overrides?: Partial<PortalInvitation>,
): PortalInvitation {
  return {
    id: "inv-1",
    client_id: CLIENT_ID,
    email: "client@example.com",
    invited_by: "user-1",
    auth_user_id: null,
    status: "pending",
    invited_at: "2026-01-15T10:00:00Z",
    accepted_at: null,
    last_login: null,
    ...overrides,
  };
}

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("PortalSharingSettings", () => {
  describe("Module Toggles", () => {
    it("renders toggle switches for all 7 modules", () => {
      render(
        <PortalSharingSettings
          clientId={CLIENT_ID}
          settings={makeSettings()}
          invitations={[]}
        />,
      );

      expect(screen.getByText("Timesheet")).toBeDefined();
      expect(screen.getByText("Tasks")).toBeDefined();
      expect(screen.getByText("Meetings")).toBeDefined();
      expect(screen.getByText("Deliverables")).toBeDefined();
      expect(screen.getByText("Invoicing")).toBeDefined();
      expect(screen.getByText("Notes")).toBeDefined();
      expect(screen.getByText("Research")).toBeDefined();

      // All 7 switches should exist
      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(7);
    });

    it("calls updatePortalSetting with correct params when toggled", async () => {
      mockUpdatePortalSetting.mockResolvedValue({ success: true });

      render(
        <PortalSharingSettings
          clientId={CLIENT_ID}
          settings={makeSettings()}
          invitations={[]}
        />,
      );

      const switches = screen.getAllByRole("switch");
      // Toggle the first switch (Timesheet)
      fireEvent.click(switches[0]);

      await waitFor(() => {
        expect(mockUpdatePortalSetting).toHaveBeenCalledWith(
          CLIENT_ID,
          "timesheet",
          true,
        );
      });
    });
  });

  describe("Invitation Table", () => {
    it("shows correct status badges for different invitation statuses", () => {
      const invitations: PortalInvitation[] = [
        makeInvitation({
          id: "inv-1",
          email: "pending@test.com",
          status: "pending",
        }),
        makeInvitation({
          id: "inv-2",
          email: "active@test.com",
          status: "accepted",
          accepted_at: "2026-01-20T10:00:00Z",
          last_login: "2026-02-01T10:00:00Z",
        }),
        makeInvitation({
          id: "inv-3",
          email: "revoked@test.com",
          status: "revoked",
        }),
      ];

      render(
        <PortalSharingSettings
          clientId={CLIENT_ID}
          settings={makeSettings()}
          invitations={invitations}
        />,
      );

      expect(screen.getByText("pending@test.com")).toBeDefined();
      expect(screen.getByText("active@test.com")).toBeDefined();
      expect(screen.getByText("revoked@test.com")).toBeDefined();

      expect(screen.getByText("Pending")).toBeDefined();
      expect(screen.getByText("Active")).toBeDefined();
      expect(screen.getByText("Revoked")).toBeDefined();
    });
  });

  describe("Invite Dialog", () => {
    it("validates email format before calling invite", async () => {
      render(
        <PortalSharingSettings
          clientId={CLIENT_ID}
          settings={makeSettings()}
          invitations={[]}
        />,
      );

      // Open invite dialog
      fireEvent.click(screen.getByText("Invite User"));

      // Try to submit without email
      fireEvent.click(screen.getByText("Send Invitation"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Enter a valid email address");
      });
      expect(mockInvitePortalUser).not.toHaveBeenCalled();
    });
  });

  describe("Revoke", () => {
    it("shows confirmation dialog before revoking", async () => {
      mockRevokePortalUser.mockResolvedValue({ success: true });

      render(
        <PortalSharingSettings
          clientId={CLIENT_ID}
          settings={makeSettings()}
          invitations={[
            makeInvitation({ status: "accepted", email: "user@test.com" }),
          ]}
        />,
      );

      // Click Revoke button
      fireEvent.click(screen.getByText("Revoke"));

      // Confirmation dialog should appear
      await waitFor(() => {
        expect(screen.getByText("Revoke portal access?")).toBeDefined();
      });

      // Confirm revocation
      fireEvent.click(screen.getByText("Revoke Access"));

      await waitFor(() => {
        expect(mockRevokePortalUser).toHaveBeenCalledWith("inv-1");
      });
    });
  });
});

// ──────────────────────────────────────────────────────────
// Portal Active Indicator
// ──────────────────────────────────────────────────────────

describe("Portal Active Indicator", () => {
  // We test the CustomerDetailHeader separately
  it("shows correctly based on settings", async () => {
    // Import dynamically to avoid module-level issues
    const { CustomerDetailHeader } =
      await import("@/components/crm/customer-detail-header");

    const customer = {
      id: "cust-1",
      client_id: CLIENT_ID,
      name: "Test Customer",
      slug: "test-customer",
      website: null,
      industry: null,
      description: null,
      status: "active" as const,
      primary_contact: null,
      google_drive_url: null,
      is_client_visible: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    const { unmount } = render(
      <CustomerDetailHeader customer={customer} isPortalActive={true} />,
    );
    expect(screen.getByText("Portal Active")).toBeDefined();
    unmount();

    render(<CustomerDetailHeader customer={customer} isPortalActive={false} />);
    expect(screen.getByText("Portal Inactive")).toBeDefined();
  });
});

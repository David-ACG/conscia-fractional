import { describe, it, expect, vi } from "vitest";
import { render, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ScopeCreepLog } from "./scope-creep-log";
import type { ScopeCreepEntry } from "@/lib/types";

vi.mock("@/lib/actions/engagement", () => ({
  createScopeCreepEntry: vi.fn().mockResolvedValue({ success: true }),
  updateScopeCreepStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteScopeCreepEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ScopeCreepLog", () => {
  it("renders empty state", () => {
    const { container } = render(
      <ScopeCreepLog engagementId="e1" clientId="c1" entries={[]} />,
    );
    const el = within(container);
    expect(el.getByText(/No scope creep logged yet/)).toBeInTheDocument();
  });

  it("renders Log New button", () => {
    const { container } = render(
      <ScopeCreepLog engagementId="e1" clientId="c1" entries={[]} />,
    );
    const el = within(container);
    expect(el.getByText("Log New")).toBeInTheDocument();
  });

  it("opens dialog when Log New is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ScopeCreepLog engagementId="e1" clientId="c1" entries={[]} />,
    );
    const el = within(container);

    await user.click(el.getByText("Log New"));
    // Dialog renders in portal, so use screen
    expect(screen.getByText("Log Scope Creep Request")).toBeInTheDocument();
  });

  it("renders entries with descriptions", () => {
    const entries: ScopeCreepEntry[] = [
      {
        id: "sc1",
        engagement_id: "e1",
        client_id: "c1",
        description: "Add extra reporting module",
        requested_by: "Client PM",
        requested_date: "2026-03-25",
        status: "discussed",
        notes: "Needs cost estimate",
        created_at: new Date().toISOString(),
      },
    ];
    const { container } = render(
      <ScopeCreepLog engagementId="e1" clientId="c1" entries={entries} />,
    );
    const el = within(container);
    expect(el.getByText("Add extra reporting module")).toBeInTheDocument();
    expect(el.getByText("From: Client PM")).toBeInTheDocument();
    expect(el.getByText("Needs cost estimate")).toBeInTheDocument();
  });
});

// Need screen import for portal-based dialog
import { screen } from "@testing-library/react";

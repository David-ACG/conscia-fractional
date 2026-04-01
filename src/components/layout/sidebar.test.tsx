import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

// Mock use-sidebar hook
vi.mock("@/hooks/use-sidebar", () => ({
  useSidebar: () => ({
    isOpen: true,
    isMobile: false,
    toggle: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

import { Sidebar } from "./sidebar";

describe("Sidebar", () => {
  it("renders all nav items", () => {
    render(<Sidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Calendar")).toBeInTheDocument();
    expect(screen.getByText("Timesheet")).toBeInTheDocument();
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("Meetings")).toBeInTheDocument();
    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("CRM")).toBeInTheDocument();
    expect(screen.getByText("Engagement")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Notes")).toBeInTheDocument();
    expect(screen.getByText("Assets")).toBeInTheDocument();
    expect(screen.getByText("Deliverables")).toBeInTheDocument();
    expect(screen.getByText("Invoicing")).toBeInTheDocument();
    expect(screen.getByText("Shared with Client")).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import type { Meeting } from "@/lib/types";

// Mock Radix Sheet to avoid portal issues in JSDOM
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock react-markdown to render markdown as actual HTML elements
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => {
    // Simple mock that converts markdown to recognisable HTML
    const html = children
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^- (.+)$/gm, "<li>$1</li>");
    return (
      <div
        data-testid="react-markdown"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  },
}));

vi.mock("remark-gfm", () => ({ default: () => {} }));

import { MeetingDetail } from "../meeting-detail";

type MeetingWithCustomer = Meeting & { crm_customer: { name: string } | null };

function makeMeeting(
  overrides: Partial<MeetingWithCustomer> = {},
): MeetingWithCustomer {
  return {
    id: "test-1",
    user_id: "u1",
    title: "Test Meeting",
    meeting_date: "2026-04-03T10:00:00Z",
    duration_minutes: 30,
    platform: "zoom",
    summary: null,
    transcript: null,
    action_items: [],
    attendees: [],
    recording_url: null,
    customer_id: null,
    created_at: "2026-04-03T10:00:00Z",
    updated_at: "2026-04-03T10:00:00Z",
    original_filename: null,
    actual_duration_seconds: null,
    crm_customer: null,
    ...overrides,
  };
}

describe("MeetingDetail", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    isLogged: false,
    onLogToTimesheet: vi.fn(),
    loggingId: null,
    onEdit: vi.fn(),
  };

  it("renders markdown summary with prose classes", () => {
    const meeting = makeMeeting({
      summary:
        "## Meeting Summary\n\n- **Action item** one\n- Item two\n\n### Details\n\nSome details here.",
    });

    const { container } = render(
      <MeetingDetail meeting={meeting} {...defaultProps} />,
    );

    // The prose wrapper should exist with correct classes
    const proseDiv = container.querySelector(".prose.prose-sm");
    expect(proseDiv).toBeTruthy();
    expect(proseDiv?.classList.contains("dark:prose-invert")).toBe(true);
    expect(proseDiv?.classList.contains("max-w-none")).toBe(true);
  });

  it("renders heading and bold text from markdown", () => {
    const meeting = makeMeeting({
      summary: "## Key Points\n\n- **Important** note",
    });

    render(<MeetingDetail meeting={meeting} {...defaultProps} />);

    const mdElements = screen.getAllByTestId("react-markdown");
    const md = mdElements[0];
    expect(md.querySelector("h2")).toBeTruthy();
    expect(md.querySelector("strong")).toBeTruthy();
    expect(md.querySelector("li")).toBeTruthy();
  });

  it("renders plain text summaries without errors", () => {
    const meeting = makeMeeting({
      summary: "This is just a plain text summary with no markdown formatting.",
    });

    render(<MeetingDetail meeting={meeting} {...defaultProps} />);

    expect(screen.getAllByTestId("react-markdown").length).toBeGreaterThan(0);
    expect(screen.getByText(/plain text summary/)).toBeTruthy();
  });

  it("does not render summary section when summary is null", () => {
    const meeting = makeMeeting({ summary: null });

    const { container } = render(
      <MeetingDetail meeting={meeting} {...defaultProps} />,
    );

    expect(container.querySelector(".prose")).toBeNull();
  });

  it("shows Download PDF button when summary exists", () => {
    const meeting = makeMeeting({ summary: "Some summary" });

    render(<MeetingDetail meeting={meeting} {...defaultProps} />);

    // The button text may be split by the icon SVG, so use a flexible matcher
    const buttons = screen.getAllByRole("button");
    const pdfButton = buttons.find((b) =>
      b.textContent?.includes("Download PDF"),
    );
    expect(pdfButton).toBeTruthy();
  });
});

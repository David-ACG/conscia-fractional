import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import {
  EventDetailDialog,
  type CalendarEventForDialog,
} from "../event-detail-dialog";

// next/link renders as <a> in jsdom
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const baseEvent: CalendarEventForDialog = {
  id: "evt-1",
  title: "Weekly Sync",
  start: "2026-04-01T10:00:00Z",
  end: "2026-04-01T11:00:00Z",
  location: null,
  meeting_url: null,
  attendees: [],
  crm_customer: null,
  meeting_id: null,
  status: "confirmed",
  google_event_id: "abc123",
};

describe("EventDetailDialog", () => {
  it("renders event title and time", () => {
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={vi.fn()} />,
    );

    expect(screen.getByText("Weekly Sync")).toBeInTheDocument();
    // Date label exists
    expect(screen.getByText(/April 1, 2026/)).toBeInTheDocument();
    // Time range shown (time depends on local timezone, just check AM/PM pattern)
    expect(
      screen.getByText(/\d{1,2}:\d{2} [AP]M – \d{1,2}:\d{2} [AP]M/),
    ).toBeInTheDocument();
  });

  it("renders location when provided", () => {
    const event = { ...baseEvent, location: "Conference Room A" };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);
    expect(screen.getByText("Conference Room A")).toBeInTheDocument();
  });

  it("does not render location when absent", () => {
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={vi.fn()} />,
    );
    expect(screen.queryByText("Conference Room A")).not.toBeInTheDocument();
  });

  it("renders meeting URL link for Google Meet events", () => {
    const event = {
      ...baseEvent,
      meeting_url: "https://meet.google.com/abc-def-ghi",
    };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);

    const link = screen.getByTestId("meeting-url-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://meet.google.com/abc-def-ghi");
    expect(link).toHaveAttribute("data-platform", "meet");
    expect(screen.getByText("Join Google Meet")).toBeInTheDocument();
  });

  it("renders meeting URL link for Zoom events", () => {
    const event = {
      ...baseEvent,
      meeting_url: "https://zoom.us/j/12345678",
    };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);

    const link = screen.getByTestId("meeting-url-link");
    expect(link).toHaveAttribute("data-platform", "zoom");
    expect(screen.getByText("Join Zoom")).toBeInTheDocument();
  });

  it("renders meeting URL link for Teams events", () => {
    const event = {
      ...baseEvent,
      meeting_url: "https://teams.microsoft.com/l/meetup-join/abc",
    };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);

    const link = screen.getByTestId("meeting-url-link");
    expect(link).toHaveAttribute("data-platform", "teams");
    expect(screen.getByText("Join Teams")).toBeInTheDocument();
  });

  it("renders attendees with correct response status badges", () => {
    const event = {
      ...baseEvent,
      attendees: [
        {
          email: "alice@example.com",
          name: "Alice",
          responseStatus: "accepted" as const,
        },
        {
          email: "bob@example.com",
          name: "Bob",
          responseStatus: "declined" as const,
        },
        { email: "carol@example.com", responseStatus: "tentative" as const },
        { email: "dave@example.com", responseStatus: "needsAction" as const },
      ],
    };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);

    expect(screen.getByTestId("attendees-list")).toBeInTheDocument();
    expect(screen.getByTestId("attendee-status-accepted")).toHaveTextContent(
      "Accepted",
    );
    expect(screen.getByTestId("attendee-status-declined")).toHaveTextContent(
      "Declined",
    );
    expect(screen.getByTestId("attendee-status-tentative")).toHaveTextContent(
      "Tentative",
    );
    expect(screen.getByTestId("attendee-status-needsAction")).toHaveTextContent(
      "Pending",
    );
  });

  it("renders CRM customer link when customer is linked", () => {
    const event = {
      ...baseEvent,
      crm_customer: { id: "cust-1", name: "Acme Corp", slug: "acme-corp" },
    };
    render(<EventDetailDialog event={event} open={true} onClose={vi.fn()} />);

    const link = screen.getByTestId("crm-customer-link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveTextContent("Acme Corp");
    expect(link).toHaveAttribute("href", "/crm/acme-corp");
  });

  it("does not render CRM customer link when no customer", () => {
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={vi.fn()} />,
    );
    expect(screen.queryByTestId("crm-customer-link")).not.toBeInTheDocument();
  });

  it("action buttons navigate to correct URLs", () => {
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={vi.fn()} />,
    );

    const recordBtn = screen.getByTestId("record-meeting-btn");
    expect(recordBtn).toHaveAttribute(
      "href",
      "/meetings?record=true&from_event=evt-1",
    );

    const createBtn = screen.getByTestId("create-meeting-btn");
    expect(createBtn).toHaveAttribute("href", "/meetings?from_event=evt-1");
  });

  it("renders Google Calendar link when google_event_id is set", () => {
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={vi.fn()} />,
    );
    const btn = screen.getByTestId("open-google-calendar-btn");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute("target", "_blank");
  });

  it("calls onClose when dialog close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <EventDetailDialog event={baseEvent} open={true} onClose={onClose} />,
    );
    // Radix Dialog close button — press Escape
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing when event is null", () => {
    const { container } = render(
      <EventDetailDialog event={null} open={false} onClose={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

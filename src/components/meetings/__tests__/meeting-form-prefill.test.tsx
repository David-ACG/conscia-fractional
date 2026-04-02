import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  act,
} from "@testing-library/react";

// ──────────────────────────────────────────────────────────
// Mock Radix Dialog to avoid portal / context propagation issues in JSDOM
// ──────────────────────────────────────────────────────────
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    children,
    open,
  }: {
    children: React.ReactNode;
    open?: boolean;
  }) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

// Mock Radix Select to avoid its portal
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span>{placeholder}</span>
  ),
}));

// Mock shadcn form components to avoid FormFieldContext null-context issues in JSDOM
// (Controller from react-hook-form still wires inputs to form state via render prop)
vi.mock("@/components/ui/form", async () => {
  const { Controller, FormProvider } = await import("react-hook-form");
  return {
    Form: FormProvider,
    FormField: (props: Parameters<typeof Controller>[0]) => (
      <Controller {...props} />
    ),
    FormItem: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    FormLabel: ({ children }: { children: React.ReactNode }) => (
      <label>{children}</label>
    ),
    FormControl: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
    FormMessage: () => null,
  };
});

// ──────────────────────────────────────────────────────────
// Mock server actions
// ──────────────────────────────────────────────────────────
const mockCreateMeeting = vi.fn();
const mockUpdateMeeting = vi.fn();
vi.mock("@/lib/actions/meetings", () => ({
  createMeeting: (...args: unknown[]) => mockCreateMeeting(...args),
  updateMeeting: (...args: unknown[]) => mockUpdateMeeting(...args),
}));

const mockLinkMeetingToEventAction = vi.fn();
vi.mock("@/lib/actions/calendar", () => ({
  linkMeetingToEventAction: (...args: unknown[]) =>
    mockLinkMeetingToEventAction(...args),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ──────────────────────────────────────────────────────────
import { MeetingForm } from "../meeting-form";
import type { MeetingPreFillData } from "@/lib/types";

const sampleCustomers = [
  { id: "cust-1", name: "Acme Corp" },
  { id: "cust-2", name: "Beta Ltd" },
];

const samplePrefillData: MeetingPreFillData = {
  title: "Architecture Review",
  date: "2026-04-01T09:00:00.000Z",
  duration: 60,
  crm_customer_id: "cust-1",
  participants: [
    { contact_id: "c-1", email: "alice@acme.com", name: "Alice" },
    { email: "bob@beta.com", name: "Bob" },
  ],
  meeting_url: "https://meet.google.com/abc",
  source_event_id: "evt-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("MeetingForm — pre-fill from calendar event", () => {
  it("shows the pre-fill banner when prefillData is provided", () => {
    render(
      <MeetingForm
        open={true}
        onOpenChange={vi.fn()}
        customers={sampleCustomers}
        prefillData={samplePrefillData}
      />,
    );

    expect(screen.getByTestId("prefill-banner")).toBeInTheDocument();
    expect(screen.getByText(/Architecture Review/i)).toBeInTheDocument();
  });

  it("does not show the banner when no prefillData", () => {
    render(
      <MeetingForm
        open={true}
        onOpenChange={vi.fn()}
        customers={sampleCustomers}
      />,
    );

    expect(screen.queryByTestId("prefill-banner")).not.toBeInTheDocument();
  });

  it("calls onClear when the Clear button is clicked", () => {
    const onClear = vi.fn();
    render(
      <MeetingForm
        open={true}
        onOpenChange={vi.fn()}
        customers={sampleCustomers}
        prefillData={samplePrefillData}
        onClear={onClear}
      />,
    );

    fireEvent.click(screen.getByTestId("prefill-clear-btn"));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("pre-fills the title field from calendar event", async () => {
    await act(async () => {
      render(
        <MeetingForm
          open={true}
          onOpenChange={vi.fn()}
          customers={sampleCustomers}
          prefillData={samplePrefillData}
        />,
      );
    });

    const titleInput = screen.getByPlaceholderText("Meeting title");
    expect((titleInput as HTMLInputElement).value).toBe("Architecture Review");
  });

  it("pre-fills the duration field", async () => {
    await act(async () => {
      render(
        <MeetingForm
          open={true}
          onOpenChange={vi.fn()}
          customers={sampleCustomers}
          prefillData={samplePrefillData}
        />,
      );
    });

    const durationInput = screen.getByPlaceholderText("e.g. 60");
    expect((durationInput as HTMLInputElement).value).toBe("60");
  });

  it("links meeting to event after successful creation", async () => {
    mockCreateMeeting.mockResolvedValue({
      success: true,
      meetingId: "meeting-new-1",
    });

    await act(async () => {
      render(
        <MeetingForm
          open={true}
          onOpenChange={vi.fn()}
          customers={sampleCustomers}
          prefillData={samplePrefillData}
        />,
      );
    });

    // Submit the form (title is pre-filled so validation should pass)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add Meeting" }));
    });

    await waitFor(() => {
      expect(mockCreateMeeting).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(mockLinkMeetingToEventAction).toHaveBeenCalledWith(
        "meeting-new-1",
        "evt-1",
      );
    });
  });

  it("does not show banner when editing an existing meeting even with prefillData", () => {
    const existingMeeting = {
      id: "m-existing",
      client_id: "client-1",
      crm_customer_id: "cust-2",
      title: "Old Meeting",
      meeting_date: "2026-03-01T10:00:00Z",
      duration_minutes: 30,
      attendees: [],
      transcript: null,
      summary: null,
      action_items: [],
      recording_url: null,
      platform: null as null,
      is_client_visible: false,
      created_at: "2026-03-01T00:00:00Z",
      updated_at: "2026-03-01T00:00:00Z",
    };

    render(
      <MeetingForm
        open={true}
        onOpenChange={vi.fn()}
        meeting={existingMeeting}
        customers={sampleCustomers}
        prefillData={samplePrefillData}
      />,
    );

    // Banner should NOT show when editing
    expect(screen.queryByTestId("prefill-banner")).not.toBeInTheDocument();
    // Title should be from the existing meeting, not the prefill
    const titleInput = screen.getByPlaceholderText("Meeting title");
    expect((titleInput as HTMLInputElement).value).toBe("Old Meeting");
  });
});

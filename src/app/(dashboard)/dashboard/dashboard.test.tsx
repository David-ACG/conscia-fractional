import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HoursCard } from "@/components/dashboard/hours-card";
import { EngagementCard } from "@/components/dashboard/engagement-card";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { MeetingsCard } from "@/components/dashboard/meetings-card";
import { TasksCard } from "@/components/dashboard/tasks-card";
import { ActivityCard } from "@/components/dashboard/activity-card";
import type { TimeEntry, Engagement, Client } from "@/lib/types";

// Mock server-side dependencies for async components
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ value: "test-client-id" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: [], count: 0 })),
              })),
              limit: vi.fn(() => ({ data: [], count: 0 })),
            })),
          })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], count: 0 })),
          })),
          limit: vi.fn(() => ({
            single: vi.fn(() => ({ data: null })),
          })),
          single: vi.fn(() => ({ data: null })),
        })),
      })),
    })),
  })),
}));

const mockTimeEntries: TimeEntry[] = [
  {
    id: "1",
    client_id: "c1",
    crm_customer_id: null,
    category: "Development",
    description: "Building dashboard",
    started_at: new Date().toISOString(),
    stopped_at: new Date().toISOString(),
    duration_minutes: 120,
    is_manual: false,
    meeting_id: null,
    is_billable: true,
    freeagent_timeslip_id: null,
    is_client_visible: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    client_id: "c1",
    crm_customer_id: null,
    category: "Meetings",
    description: "Standup",
    started_at: new Date().toISOString(),
    stopped_at: new Date().toISOString(),
    duration_minutes: 30,
    is_manual: false,
    meeting_id: null,
    is_billable: true,
    freeagent_timeslip_id: null,
    is_client_visible: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const mockEngagement: Engagement & { client: Client } = {
  id: "e1",
  client_id: "c1",
  role_title: "Solution Architect",
  start_date: "2026-03-23",
  end_date: null,
  hours_per_week: 16,
  day_rate_gbp: 500,
  hourly_rate_gbp: 62.5,
  billing_frequency: "monthly",
  payment_terms: "Net 10",
  scope: [
    "Customer representation",
    "Solution delivery",
    "Platform familiarity",
  ],
  out_of_scope: [],
  contract_data: {},
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  client: {
    id: "c1",
    name: "Conscia",
    slug: "conscia",
    website: "https://conscia.ai",
    industry: "DXO",
    description: null,
    logo_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

describe("Dashboard", () => {
  describe("HoursCard", () => {
    it("renders with zero hours when no entries", () => {
      render(<HoursCard timeEntries={[]} weeklyLimit={16} hourlyRate={62.5} />);
      expect(screen.getByText("Hours This Week")).toBeInTheDocument();
      expect(screen.getByText(/0\.0h/)).toBeInTheDocument();
      expect(screen.getByText("/ 16h")).toBeInTheDocument();
      expect(screen.getByText("No time logged this week")).toBeInTheDocument();
    });

    it("renders with mock data showing hours and categories", () => {
      render(
        <HoursCard
          timeEntries={mockTimeEntries}
          weeklyLimit={16}
          hourlyRate={62.5}
        />,
      );
      expect(screen.getByText(/2\.5h/)).toBeInTheDocument();
      expect(screen.getByText("Development")).toBeInTheDocument();
      expect(screen.getByText("Meetings")).toBeInTheDocument();
      expect(screen.getByText("£156 earned this week")).toBeInTheDocument();
    });
  });

  describe("EngagementCard", () => {
    it("renders engagement details", () => {
      render(<EngagementCard engagement={mockEngagement} />);
      expect(screen.getByText("Conscia")).toBeInTheDocument();
      expect(screen.getByText("Solution Architect")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
      expect(screen.getByText("£62.5/hr")).toBeInTheDocument();
      expect(screen.getByText("16h")).toBeInTheDocument();
    });

    it("renders empty state when no engagement", () => {
      render(<EngagementCard engagement={null} />);
      expect(screen.getByText("No active engagement")).toBeInTheDocument();
    });
  });

  describe("QuickActions", () => {
    it("renders action buttons with correct links", () => {
      render(<QuickActions />);
      const timerLink = screen.getByText("Start Timer").closest("a");
      const noteLink = screen.getByText("Add Note").closest("a");
      const logLink = screen.getByText("Log Time").closest("a");
      expect(timerLink).toHaveAttribute("href", "/timer");
      expect(noteLink).toHaveAttribute("href", "/notes");
      expect(logLink).toHaveAttribute("href", "/timesheet");
    });
  });

  describe("MeetingsCard", () => {
    it("renders with heading", async () => {
      const Component = await MeetingsCard();
      render(Component);
      expect(screen.getByText("Recent Meetings")).toBeInTheDocument();
    });
  });

  describe("TasksCard", () => {
    it("renders with heading", async () => {
      const Component = await TasksCard();
      render(Component);
      expect(screen.getByText("Active Tasks")).toBeInTheDocument();
    });
  });

  describe("ActivityCard", () => {
    it("renders empty state when no activity", () => {
      render(<ActivityCard timeEntries={[]} notes={[]} deliverables={[]} />);
      expect(screen.getByText("No recent activity")).toBeInTheDocument();
    });

    it("renders activity feed with time entries", () => {
      render(
        <ActivityCard
          timeEntries={mockTimeEntries}
          notes={[]}
          deliverables={[]}
        />,
      );
      expect(
        screen.getByText(/Logged 2\.0h — Development/),
      ).toBeInTheDocument();
      expect(screen.getByText(/Logged 0\.5h — Meetings/)).toBeInTheDocument();
    });
  });
});

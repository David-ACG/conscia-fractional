import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ContractTerms } from "@/components/engagement/contract-terms";
import { ScopeCard } from "@/components/engagement/scope-card";
import { ScopeCreepLog } from "@/components/engagement/scope-creep-log";
import type { Engagement, Client, ScopeCreepEntry } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/actions/engagement", () => ({
  updateScope: vi.fn().mockResolvedValue({ success: true }),
  createScopeCreepEntry: vi.fn().mockResolvedValue({ success: true }),
  updateScopeCreepStatus: vi.fn().mockResolvedValue({ success: true }),
  deleteScopeCreepEntry: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockClient: Client = {
  id: "c1",
  name: "Conscia",
  slug: "conscia",
  website: "https://conscia.ai",
  industry: "DXO",
  description: null,
  logo_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const mockEngagement: Engagement & { client: Client } = {
  id: "e1",
  client_id: "c1",
  client: mockClient,
  role_title: "Solution Architect",
  start_date: "2026-03-23",
  end_date: null,
  hours_per_week: 16,
  day_rate_gbp: 500,
  hourly_rate_gbp: 62.5,
  billing_frequency: "monthly",
  payment_terms: "Net 10 days after Conscia receives client payment",
  scope: [
    "Customer representation for POC projects",
    "Solution delivery — architect, develop, implement solutions",
    "Platform familiarity — Conscia Orchestration platform",
  ],
  out_of_scope: ["Full-time availability", "Production support"],
  contract_data: {},
  status: "active",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("Engagement Overview", () => {
  describe("ContractTerms", () => {
    it("renders client name and role", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(el.getByText("Conscia")).toBeInTheDocument();
      expect(el.getByText("Solution Architect")).toBeInTheDocument();
    });

    it("renders day rate and hourly rate", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(el.getByText("£500")).toBeInTheDocument();
      expect(el.getByText("£62.50")).toBeInTheDocument();
    });

    it("renders hours per week", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(el.getByText("16")).toBeInTheDocument();
    });

    it("renders status badge", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(el.getByText("active")).toBeInTheDocument();
    });

    it("renders Ongoing when no end date", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(el.getByText("Ongoing")).toBeInTheDocument();
    });

    it("renders payment terms", () => {
      const { container } = render(
        <ContractTerms engagement={mockEngagement} />,
      );
      const el = within(container);
      expect(
        el.getByText("Net 10 days after Conscia receives client payment"),
      ).toBeInTheDocument();
    });
  });

  describe("ScopeCard", () => {
    it("renders in-scope items as checklist", () => {
      const { container } = render(
        <ScopeCard
          engagementId="e1"
          scope={mockEngagement.scope}
          outOfScope={mockEngagement.out_of_scope}
        />,
      );
      const el = within(container);
      expect(
        el.getByText("Customer representation for POC projects"),
      ).toBeInTheDocument();
      expect(
        el.getByText(
          "Solution delivery — architect, develop, implement solutions",
        ),
      ).toBeInTheDocument();
    });

    it("renders out-of-scope items", () => {
      const { container } = render(
        <ScopeCard
          engagementId="e1"
          scope={mockEngagement.scope}
          outOfScope={mockEngagement.out_of_scope}
        />,
      );
      const el = within(container);
      expect(el.getByText("Full-time availability")).toBeInTheDocument();
      expect(el.getByText("Production support")).toBeInTheDocument();
    });

    it("renders edit scope button", () => {
      const { container } = render(
        <ScopeCard
          engagementId="e1"
          scope={mockEngagement.scope}
          outOfScope={mockEngagement.out_of_scope}
        />,
      );
      const el = within(container);
      expect(el.getByText("Edit scope")).toBeInTheDocument();
    });
  });

  describe("ScopeCreepLog", () => {
    it("renders empty state when no entries", () => {
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

    it("renders entries with status badges", () => {
      const entries: ScopeCreepEntry[] = [
        {
          id: "sc1",
          engagement_id: "e1",
          client_id: "c1",
          description: "Client wants extra reporting dashboard",
          requested_by: "Sana Remekie",
          requested_date: "2026-03-25",
          status: "logged",
          notes: null,
          created_at: new Date().toISOString(),
        },
      ];
      const { container } = render(
        <ScopeCreepLog engagementId="e1" clientId="c1" entries={entries} />,
      );
      const el = within(container);
      expect(
        el.getByText("Client wants extra reporting dashboard"),
      ).toBeInTheDocument();
      expect(el.getByText("From: Sana Remekie")).toBeInTheDocument();
    });
  });
});

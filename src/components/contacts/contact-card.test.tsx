import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactCard } from "./contact-card";
import type { Contact } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/actions/contacts", () => ({
  deleteContact: vi.fn().mockResolvedValue({ success: true }),
  toggleContactVisibility: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockContact: Contact = {
  id: "1",
  client_id: "c1",
  name: "Sana Remekie",
  role: "CEO & Co-founder",
  email: "sana@conscia.ai",
  phone: "+1 416 555 0100",
  slack_id: "U0123456789",
  linkedin_url: "https://www.linkedin.com/in/sana-remekie/",
  preferred_contact_method: "slack",
  skills: ["DXO", "Composable Architecture", "MACH"],
  working_on: "Platform architecture review",
  notes: "Some notes",
  is_client_visible: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

describe("ContactCard", () => {
  const onEdit = vi.fn();

  function renderCard(contact: Contact = mockContact) {
    const result = render(<ContactCard contact={contact} onEdit={onEdit} />);
    // Use the first card element as the scoped container
    const card = result.container.querySelector("[class*='rounded-xl']")!;
    return { ...result, card: within(card as HTMLElement) };
  }

  it("renders contact name and role", () => {
    const { card } = renderCard();
    expect(card.getByText("Sana Remekie")).toBeInTheDocument();
    expect(card.getByText("CEO & Co-founder")).toBeInTheDocument();
  });

  it("renders preferred contact method badge", () => {
    const { card } = renderCard();
    expect(card.getByText("Slack")).toBeInTheDocument();
  });

  it("renders skills badges", () => {
    const { card } = renderCard();
    expect(card.getByText("DXO")).toBeInTheDocument();
    expect(card.getByText("Composable Architecture")).toBeInTheDocument();
    expect(card.getByText("MACH")).toBeInTheDocument();
  });

  it("renders working on text", () => {
    const { card } = renderCard();
    expect(card.getByText(/Platform architecture review/)).toBeInTheDocument();
  });

  it("renders initials in avatar", () => {
    const { card } = renderCard();
    expect(card.getByText("SR")).toBeInTheDocument();
  });

  it("renders LinkedIn link with target _blank", () => {
    const { card } = renderCard();
    const allLinks = card.getAllByRole("link");
    const linkedinLink = allLinks.find((l) =>
      l.getAttribute("href")?.includes("linkedin.com"),
    );
    expect(linkedinLink).toBeTruthy();
    expect(linkedinLink).toHaveAttribute("target", "_blank");
  });

  it("renders email mailto link", () => {
    const { card } = renderCard();
    const allLinks = card.getAllByRole("link");
    const mailtoLink = allLinks.find((l) =>
      l.getAttribute("href")?.startsWith("mailto:"),
    );
    expect(mailtoLink).toBeTruthy();
    expect(mailtoLink).toHaveAttribute("href", "mailto:sana@conscia.ai");
  });

  it("calls onEdit when edit button is clicked", async () => {
    const { card } = renderCard();
    const user = userEvent.setup();
    const editBtn = card.getByLabelText("Edit contact");
    await user.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(mockContact);
  });

  it("opens delete confirmation dialog when delete is clicked", async () => {
    const user = userEvent.setup();
    renderCard();
    // Use getAllByLabelText since the delete button may appear in multiple portals
    const deleteBtns = screen.getAllByLabelText("Delete contact");
    await user.click(deleteBtns[0]);
    expect(
      screen.getByText(/Are you sure you want to delete Sana Remekie/),
    ).toBeInTheDocument();
  });

  it("renders email method badge when preferred method is email", () => {
    const emailContact = {
      ...mockContact,
      preferred_contact_method: "email" as const,
    };
    const { card } = renderCard(emailContact);
    expect(card.getByText("Email")).toBeInTheDocument();
  });
});

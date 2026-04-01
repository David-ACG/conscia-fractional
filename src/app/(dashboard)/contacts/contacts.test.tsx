import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContactList } from "@/components/contacts/contact-list";
import type { Contact } from "@/lib/types";

// Mock server actions
vi.mock("@/lib/actions/contacts", () => ({
  createContact: vi.fn().mockResolvedValue({ success: true }),
  updateContact: vi.fn().mockResolvedValue({ success: true }),
  deleteContact: vi.fn().mockResolvedValue({ success: true }),
  toggleContactVisibility: vi.fn().mockResolvedValue({ success: true }),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockContacts: Contact[] = [
  {
    id: "1",
    client_id: "c1",
    name: "Sana Remekie",
    role: "CEO & Co-founder",
    email: "sana@conscia.ai",
    phone: null,
    slack_id: null,
    linkedin_url: "https://www.linkedin.com/in/sana-remekie/",
    preferred_contact_method: "slack",
    skills: ["DXO", "Composable Architecture", "MACH"],
    working_on: null,
    notes: null,
    is_client_visible: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "2",
    client_id: "c1",
    name: "Morgan Johanson",
    role: "Partnerships and Customer Success Lead",
    email: null,
    phone: null,
    slack_id: null,
    linkedin_url: "https://www.linkedin.com/in/morgan-johanson/",
    preferred_contact_method: "slack",
    skills: ["Customer Success", "Partnerships", "Digital Marketing"],
    working_on: null,
    notes: null,
    is_client_visible: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

function renderList(contacts = mockContacts) {
  const result = render(<ContactList contacts={contacts} allSkills={[]} />);
  // Scope queries to the rendered container to avoid Radix portal duplicates
  const container = within(result.container);
  return { ...result, container: container };
}

describe("Contacts Page", () => {
  it("renders contact list with all contacts", () => {
    const { container } = renderList();
    expect(container.getByText("Sana Remekie")).toBeInTheDocument();
    expect(container.getByText("Morgan Johanson")).toBeInTheDocument();
  });

  it("renders Add Contact button", () => {
    const { container } = renderList();
    expect(container.getByText("Add Contact")).toBeInTheDocument();
  });

  it("renders search input", () => {
    const { container } = renderList();
    expect(
      container.getByPlaceholderText(/Search by name/),
    ).toBeInTheDocument();
  });

  it("filters contacts by name", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    const searchInput = container.getByPlaceholderText(/Search by name/);
    await user.type(searchInput, "Sana");

    expect(container.getByText("Sana Remekie")).toBeInTheDocument();
    expect(container.queryByText("Morgan Johanson")).not.toBeInTheDocument();
  });

  it("filters contacts by role", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    const searchInput = container.getByPlaceholderText(/Search by name/);
    await user.type(searchInput, "CEO");

    expect(container.getByText("Sana Remekie")).toBeInTheDocument();
    expect(container.queryByText("Morgan Johanson")).not.toBeInTheDocument();
  });

  it("filters contacts by skills", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    const searchInput = container.getByPlaceholderText(/Search by name/);
    await user.type(searchInput, "Digital Marketing");

    expect(container.queryByText("Sana Remekie")).not.toBeInTheDocument();
    expect(container.getByText("Morgan Johanson")).toBeInTheDocument();
  });

  it("shows empty state when search matches nothing", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    const searchInput = container.getByPlaceholderText(/Search by name/);
    await user.type(searchInput, "nonexistent");

    expect(
      container.getByText("No contacts match your search."),
    ).toBeInTheDocument();
  });

  it("shows empty state when no contacts", () => {
    const { container } = renderList([]);
    expect(container.getByText("No contacts yet.")).toBeInTheDocument();
  });

  it("opens add dialog when Add Contact is clicked", async () => {
    const user = userEvent.setup();
    const { container } = renderList();

    await user.click(container.getByText("Add Contact"));
    // Dialog renders in portal outside container, so use screen
    expect(
      screen.getByText("Add a new contact at the client company."),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase
const mockEq = vi.fn().mockReturnThis();
const mockDelete = vi.fn(() => ({ eq: mockEq }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ error: null }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// Mock getActiveClientId
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("CRM Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockReturnValue({ error: null });
    mockEq.mockReturnValue({ error: null });
  });

  describe("createCustomer", () => {
    it("creates a customer with valid data and generates slug", async () => {
      const { createCustomer } = await import("../crm");
      const result = await createCustomer({
        name: "Acme Corp",
        website: "https://acme.com",
        industry: "Technology",
        description: "A tech company",
        status: "prospect",
        primary_contact: "John Doe",
        is_client_visible: false,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("crm_customers");
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-123",
          name: "Acme Corp",
          slug: "acme-corp",
          website: "https://acme.com",
          industry: "Technology",
          status: "prospect",
          primary_contact: "John Doe",
        }),
      );
    });

    it("returns error for invalid data", async () => {
      const { createCustomer } = await import("../crm");
      const result = await createCustomer({
        name: "",
        status: "prospect",
        is_client_visible: false,
      } as never);

      expect(result).toEqual({ error: "Invalid form data" });
    });

    it("generates slug correctly from name with special characters", async () => {
      const { createCustomer } = await import("../crm");
      await createCustomer({
        name: "  Holt Renfrew & Co.  ",
        status: "active",
        is_client_visible: false,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "holt-renfrew-co",
        }),
      );
    });
  });

  describe("updateCustomer", () => {
    it("updates customer data", async () => {
      const { updateCustomer } = await import("../crm");
      const result = await updateCustomer("cust-1", {
        name: "Updated Corp",
        website: "https://updated.com",
        industry: "Retail",
        description: "Updated description",
        status: "active",
        primary_contact: "Jane Doe",
        is_client_visible: true,
      });

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("crm_customers");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated Corp",
          slug: "updated-corp",
          status: "active",
        }),
      );
      expect(mockEq).toHaveBeenCalledWith("id", "cust-1");
    });
  });

  describe("deleteCustomer", () => {
    it("removes a customer", async () => {
      const { deleteCustomer } = await import("../crm");
      const result = await deleteCustomer("cust-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("crm_customers");
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith("id", "cust-1");
    });
  });
});

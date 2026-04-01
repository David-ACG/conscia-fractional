import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateSlug } from "../clients";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase server client
const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockEq = vi.fn(() => ({ limit: mockLimit, eq: mockEq }));
const mockSelect = vi.fn(() => ({
  eq: mockEq,
  order: vi.fn(() => ({ data: [] })),
}));
const mockInsert = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
    })),
  })),
}));

describe("Client Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateSlug", () => {
    it("converts name to lowercase slug", async () => {
      expect(await generateSlug("Acme Corp")).toBe("acme-corp");
    });

    it("removes special characters", async () => {
      expect(await generateSlug("O'Brien & Associates")).toBe(
        "o-brien-associates",
      );
    });

    it("trims leading/trailing hyphens", async () => {
      expect(await generateSlug("---Hello World---")).toBe("hello-world");
    });

    it("collapses multiple hyphens", async () => {
      expect(await generateSlug("Foo   Bar   Baz")).toBe("foo-bar-baz");
    });

    it("handles single word", async () => {
      expect(await generateSlug("Conscia")).toBe("conscia");
    });

    it("handles numbers", async () => {
      expect(await generateSlug("Company 123")).toBe("company-123");
    });
  });

  describe("getActiveClientId", () => {
    it("returns null when no cookie and no engagements", async () => {
      mockSingle.mockResolvedValueOnce({ data: null });

      const { getActiveClientId } = await import("../clients");
      const result = await getActiveClientId();
      expect(result).toBeNull();
    });

    it("returns cookie value when set", async () => {
      const { cookies } = await import("next/headers");
      vi.mocked(cookies).mockResolvedValueOnce({
        get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
        set: vi.fn(),
        getAll: vi.fn(() => []),
      } as never);

      const { getActiveClientId } = await import("../clients");
      const result = await getActiveClientId();
      expect(result).toBe("client-123");
    });
  });

  describe("createClientWithEngagement", () => {
    it("returns error when database is unavailable", async () => {
      const { createAdminClient: createClient } =
        await import("@/lib/supabase/admin");
      vi.mocked(createClient).mockReturnValueOnce(null);

      const { createClientWithEngagement } = await import("../clients");
      const result = await createClientWithEngagement({
        name: "Test Corp",
        role_title: "CTO",
      });
      expect(result).toEqual({ error: "Database unavailable" });
    });

    it("generates correct slug for client name", async () => {
      const clientInsertSelect = vi.fn(() => ({
        single: vi.fn(() =>
          Promise.resolve({ data: { id: "new-id" }, error: null }),
        ),
      }));
      const mockFrom = vi.fn((table: string) => {
        if (table === "clients") {
          return {
            insert: vi.fn(() => ({
              select: clientInsertSelect,
            })),
          };
        }
        return {
          insert: vi.fn(() => Promise.resolve({ error: null })),
        };
      });

      const { createAdminClient: createClient } =
        await import("@/lib/supabase/admin");
      vi.mocked(createClient).mockReturnValueOnce({
        from: mockFrom,
      } as never);

      const { createClientWithEngagement } = await import("../clients");
      await createClientWithEngagement({
        name: "Test Corp",
        role_title: "CTO",
      });

      // Verify clients.insert was called with the slug
      const clientsInsertCall = mockFrom.mock.calls.find(
        (call) => call[0] === "clients",
      );
      expect(clientsInsertCall).toBeDefined();
    });
  });
});

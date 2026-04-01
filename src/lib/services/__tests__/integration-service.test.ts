import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock encryption
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
}));

// Mock Supabase admin client
const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockEq3 = vi.fn(() => ({
  limit: mockLimit,
  eq: mockEq3,
  single: mockSingle,
}));
const mockEq2 = vi.fn(() => ({
  eq: mockEq3,
  limit: mockLimit,
  single: mockSingle,
}));
const mockEq1 = vi.fn(() => ({ eq: mockEq2 }));
const mockSelect = vi.fn(() => ({ eq: mockEq1, single: mockSingle }));
const mockUpsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq1 }));

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
  update: mockUpdate,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
  })),
}));

describe("integration-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset chain defaults
    mockSelect.mockReturnValue({ eq: mockEq1, single: mockSingle });
    mockEq1.mockReturnValue({ eq: mockEq2 });
    mockEq2.mockReturnValue({
      eq: mockEq3,
      limit: mockLimit,
      single: mockSingle,
    });
    mockEq3.mockReturnValue({
      limit: mockLimit,
      eq: mockEq3,
      single: mockSingle,
    });
    mockLimit.mockReturnValue({ single: mockSingle });
    mockUpsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq1 });
  });

  describe("getIntegrations", () => {
    it("returns decrypted integrations", async () => {
      const rows = [
        {
          id: "int-1",
          user_id: "user-1",
          provider: "google",
          account_identifier: "test@gmail.com",
          access_token_encrypted: "encrypted:token123",
          refresh_token_encrypted: "encrypted:refresh456",
          token_expires_at: null,
          scopes: ["email"],
          metadata: {},
          is_active: true,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      ];

      mockEq2.mockReturnValueOnce({ data: rows, error: null });

      const { getIntegrations } = await import("../integration-service");
      const result = await getIntegrations("user-1");

      expect(result).toHaveLength(1);
      expect(result[0].access_token).toBe("token123");
      expect(result[0].refresh_token).toBe("refresh456");
      expect(result[0]).not.toHaveProperty("access_token_encrypted");
      expect(result[0]).not.toHaveProperty("refresh_token_encrypted");
    });

    it("returns empty array when no data", async () => {
      mockEq2.mockReturnValueOnce({ data: null, error: null });

      const { getIntegrations } = await import("../integration-service");
      const result = await getIntegrations("user-1");
      expect(result).toEqual([]);
    });
  });

  describe("getIntegration", () => {
    it("returns null when not found", async () => {
      mockSingle.mockReturnValueOnce({
        data: null,
        error: { code: "PGRST116", message: "not found" },
      });

      const { getIntegration } = await import("../integration-service");
      const result = await getIntegration("user-1", "slack");
      expect(result).toBeNull();
    });

    it("returns decrypted integration when found", async () => {
      const row = {
        id: "int-1",
        user_id: "user-1",
        provider: "google",
        account_identifier: "test@gmail.com",
        access_token_encrypted: "encrypted:mytoken",
        refresh_token_encrypted: null,
        token_expires_at: null,
        scopes: [],
        metadata: {},
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      mockSingle.mockReturnValueOnce({ data: row, error: null });

      const { getIntegration } = await import("../integration-service");
      const result = await getIntegration("user-1", "google");

      expect(result).not.toBeNull();
      expect(result!.access_token).toBe("mytoken");
      expect(result!.refresh_token).toBeNull();
    });
  });

  describe("upsertIntegration", () => {
    it("encrypts tokens before storing", async () => {
      const { encrypt } = await import("@/lib/encryption");

      const resultRow = {
        id: "int-1",
        user_id: "user-1",
        provider: "google",
        account_identifier: "test@gmail.com",
        access_token_encrypted: "encrypted:mytoken",
        refresh_token_encrypted: "encrypted:myrefresh",
        token_expires_at: null,
        scopes: ["email"],
        metadata: {},
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      mockSingle.mockReturnValueOnce({ data: resultRow, error: null });

      const { upsertIntegration } = await import("../integration-service");
      await upsertIntegration("user-1", {
        provider: "google",
        account_identifier: "test@gmail.com",
        access_token: "mytoken",
        refresh_token: "myrefresh",
        scopes: ["email"],
      });

      expect(encrypt).toHaveBeenCalledWith("mytoken");
      expect(encrypt).toHaveBeenCalledWith("myrefresh");
      expect(mockFrom).toHaveBeenCalledWith("integrations");
    });
  });

  describe("deleteIntegration", () => {
    it("sets is_active to false", async () => {
      mockEq2.mockReturnValueOnce({ error: null });

      const { deleteIntegration } = await import("../integration-service");
      await deleteIntegration("user-1", "int-1");

      expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
      expect(mockFrom).toHaveBeenCalledWith("integrations");
    });
  });

  describe("refreshTokenIfNeeded", () => {
    it("returns false when no expiry", async () => {
      const { refreshTokenIfNeeded } = await import("../integration-service");
      const result = refreshTokenIfNeeded({
        id: "1",
        user_id: "u1",
        provider: "google",
        account_identifier: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: null,
        scopes: [],
        metadata: {},
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
      expect(result.needsRefresh).toBe(false);
    });

    it("returns true when token expires within 5 minutes", async () => {
      const { refreshTokenIfNeeded } = await import("../integration-service");
      const soon = new Date(Date.now() + 2 * 60 * 1000).toISOString(); // 2 min from now
      const result = refreshTokenIfNeeded({
        id: "1",
        user_id: "u1",
        provider: "google",
        account_identifier: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: soon,
        scopes: [],
        metadata: {},
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
      expect(result.needsRefresh).toBe(true);
    });

    it("returns false when token expires in more than 5 minutes", async () => {
      const { refreshTokenIfNeeded } = await import("../integration-service");
      const later = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min from now
      const result = refreshTokenIfNeeded({
        id: "1",
        user_id: "u1",
        provider: "google",
        account_identifier: null,
        access_token: null,
        refresh_token: null,
        token_expires_at: later,
        scopes: [],
        metadata: {},
        is_active: true,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
      expect(result.needsRefresh).toBe(false);
    });
  });
});

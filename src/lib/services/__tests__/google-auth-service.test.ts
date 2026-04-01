import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// googleapis — top-level vi.fn() mocks for the OAuth2 instance
// ──────────────────────────────────────────────────────────
const mockGenerateAuthUrl = vi.fn();
const mockGetToken = vi.fn();
const mockOAuth2RefreshToken = vi.fn();
const mockSetCredentials = vi.fn();
const mockUserinfoGet = vi.fn();

// Use a regular function (not an arrow) so it can be called with `new`
vi.mock("googleapis", () => {
  function MockOAuth2() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const self = this as any;
    self.generateAuthUrl = mockGenerateAuthUrl;
    self.getToken = mockGetToken;
    self.refreshAccessToken = mockOAuth2RefreshToken;
    self.setCredentials = mockSetCredentials;
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      oauth2: vi.fn(() => ({
        userinfo: { get: mockUserinfoGet },
      })),
    },
  };
});

// ──────────────────────────────────────────────────────────
// Encryption
// ──────────────────────────────────────────────────────────
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
}));

// ──────────────────────────────────────────────────────────
// integration-service
// ──────────────────────────────────────────────────────────
const mockUpsertIntegration = vi.fn();
vi.mock("@/lib/services/integration-service", () => ({
  upsertIntegration: (...args: unknown[]) => mockUpsertIntegration(...args),
}));

// ──────────────────────────────────────────────────────────
// Supabase admin — flat chain so any .eq().eq().single() works
// ──────────────────────────────────────────────────────────
const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Rebuild the flat chain each time so mockReturnValue overrides don't bleed between tests
  const chain: Record<string, unknown> = {};
  chain.select = mockSelect;
  chain.eq = mockEq;
  chain.update = mockUpdate;
  chain.single = mockSingle;

  mockFrom.mockReturnValue(chain);
  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockUpdate.mockReturnValue(chain);
  mockSingle.mockReturnValue({ data: null, error: null });

  // Env vars
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REDIRECT_URI =
    "http://localhost:3002/api/auth/google/callback";
});

// ──────────────────────────────────────────────────────────
describe("generateAuthUrl", () => {
  it("returns URL with correct scopes and state", async () => {
    mockGenerateAuthUrl.mockReturnValue(
      "https://accounts.google.com/o/oauth2/auth?test",
    );

    const { generateAuthUrl } = await import("../google-auth-service");
    const url = generateAuthUrl(
      ["https://www.googleapis.com/auth/drive.readonly"],
      "test-state-123",
    );

    expect(mockGenerateAuthUrl).toHaveBeenCalledWith({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: true,
      scope: ["https://www.googleapis.com/auth/drive.readonly"],
      state: "test-state-123",
    });
    expect(url).toBe("https://accounts.google.com/o/oauth2/auth?test");
  });
});

// ──────────────────────────────────────────────────────────
describe("exchangeCode", () => {
  it("returns tokens from OAuth2 client", async () => {
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token: "access-123",
        refresh_token: "refresh-456",
        expiry_date: 1700000000000,
        scope: "https://www.googleapis.com/auth/drive.readonly",
      },
    });

    const { exchangeCode } = await import("../google-auth-service");
    const result = await exchangeCode("auth-code-xyz");

    expect(mockGetToken).toHaveBeenCalledWith("auth-code-xyz");
    expect(result.access_token).toBe("access-123");
    expect(result.refresh_token).toBe("refresh-456");
    expect(result.expiry_date).toBe(1700000000000);
  });

  it("throws when exchange fails", async () => {
    mockGetToken.mockRejectedValue(new Error("invalid_grant"));

    const { exchangeCode } = await import("../google-auth-service");
    await expect(exchangeCode("bad-code")).rejects.toThrow(
      "Failed to exchange code",
    );
  });
});

// ──────────────────────────────────────────────────────────
describe("refreshAccessToken", () => {
  it("decrypts refresh token and calls OAuth2 refresh", async () => {
    mockOAuth2RefreshToken.mockResolvedValue({
      credentials: {
        access_token: "new-access-token",
        expiry_date: 1700000000000,
      },
    });

    const { decrypt } = await import("@/lib/encryption");
    const { refreshAccessToken } = await import("../google-auth-service");

    const result = await refreshAccessToken("encrypted:my-refresh-token");

    expect(decrypt).toHaveBeenCalledWith("encrypted:my-refresh-token");
    expect(mockSetCredentials).toHaveBeenCalledWith({
      refresh_token: "my-refresh-token",
    });
    expect(result.access_token).toBe("new-access-token");
  });

  it("throws on refresh failure", async () => {
    mockOAuth2RefreshToken.mockRejectedValue(new Error("token_revoked"));

    const { refreshAccessToken } = await import("../google-auth-service");
    await expect(refreshAccessToken("encrypted:revoked")).rejects.toThrow(
      "Token refresh failed",
    );
  });
});

// ──────────────────────────────────────────────────────────
describe("getValidAccessToken", () => {
  it("returns decrypted token when not expired", async () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    mockSingle.mockReturnValue({
      data: {
        id: "int-1",
        access_token_encrypted: "encrypted:valid-token",
        refresh_token_encrypted: "encrypted:refresh-token",
        token_expires_at: futureExpiry,
      },
      error: null,
    });

    const { getValidAccessToken } = await import("../google-auth-service");
    const token = await getValidAccessToken("int-1");

    expect(token).toBe("valid-token");
    expect(mockOAuth2RefreshToken).not.toHaveBeenCalled();
  });

  it("refreshes and returns new token when expired", async () => {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    mockSingle.mockReturnValue({
      data: {
        id: "int-1",
        access_token_encrypted: "encrypted:old-token",
        refresh_token_encrypted: "encrypted:my-refresh-token",
        token_expires_at: pastExpiry,
      },
      error: null,
    });
    mockOAuth2RefreshToken.mockResolvedValue({
      credentials: {
        access_token: "fresh-token",
        expiry_date: Date.now() + 3600000,
      },
    });

    const { getValidAccessToken } = await import("../google-auth-service");
    const token = await getValidAccessToken("int-1");

    expect(mockOAuth2RefreshToken).toHaveBeenCalled();
    expect(token).toBe("fresh-token");
  });
});

// ──────────────────────────────────────────────────────────
describe("storeTokens", () => {
  it("calls upsertIntegration with parsed scopes and ISO expiry", async () => {
    mockUpsertIntegration.mockResolvedValue({});

    const { storeTokens } = await import("../google-auth-service");
    await storeTokens("user-1", "user@gmail.com", {
      access_token: "access",
      refresh_token: "refresh",
      expiry_date: 1700000000000,
      scope:
        "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/calendar.readonly",
    });

    expect(mockUpsertIntegration).toHaveBeenCalledWith("user-1", {
      provider: "google",
      account_identifier: "user@gmail.com",
      access_token: "access",
      refresh_token: "refresh",
      token_expires_at: new Date(1700000000000).toISOString(),
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
      ],
    });
  });
});

// ──────────────────────────────────────────────────────────
describe("removeIntegration", () => {
  it("verifies user ownership before marking inactive", async () => {
    mockSingle.mockReturnValue({ data: { id: "int-1" }, error: null });

    const { removeIntegration } = await import("../google-auth-service");
    await removeIntegration("int-1", "user-1");

    expect(mockSelect).toHaveBeenCalledWith("id");
    expect(mockUpdate).toHaveBeenCalledWith({ is_active: false });
  });

  it("throws when integration not owned by user", async () => {
    mockSingle.mockReturnValue({ data: null, error: { code: "PGRST116" } });

    const { removeIntegration } = await import("../google-auth-service");
    await expect(removeIntegration("int-1", "other-user")).rejects.toThrow(
      "Integration not found or not owned by user",
    );
  });
});

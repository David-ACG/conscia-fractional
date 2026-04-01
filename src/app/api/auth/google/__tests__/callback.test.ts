import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Supabase server client mock
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Supabase admin client mock (used for incremental auth check)
const mockAdminSingle = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: mockAdminSingle,
    })),
  })),
}));

// Google auth service mocks
const mockExchangeCode = vi.fn();
const mockGetGoogleUserEmail = vi.fn();
const mockStoreTokens = vi.fn();
vi.mock("@/lib/services/google-auth-service", () => ({
  exchangeCode: (...args: unknown[]) => mockExchangeCode(...args),
  getGoogleUserEmail: (...args: unknown[]) => mockGetGoogleUserEmail(...args),
  storeTokens: (...args: unknown[]) => mockStoreTokens(...args),
}));

// next/headers cookies mock
const mockCookieGet = vi.fn();
const mockCookieDelete = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    delete: mockCookieDelete,
  })),
}));

function makeRequest(params: Record<string, string>) {
  const url = new URL("http://localhost:3002/api/auth/google/callback");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockCookieGet.mockReturnValue({ value: "valid-state" });
  // Default: no existing integration (new connection requires refresh token)
  mockAdminSingle.mockResolvedValue({ data: null, error: null });
});

describe("GET /api/auth/google/callback", () => {
  it("redirects with error=missing_code when code is absent", async () => {
    const req = makeRequest({ state: "valid-state" });

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=missing_code");
  });

  it("redirects with error=invalid_state when state does not match cookie", async () => {
    mockCookieGet.mockReturnValue({ value: "expected-state" });
    const req = makeRequest({ code: "auth-code", state: "wrong-state" });

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=invalid_state");
  });

  it("redirects with error=invalid_state when cookie is missing", async () => {
    mockCookieGet.mockReturnValue(undefined);
    const req = makeRequest({ code: "auth-code", state: "valid-state" });

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=invalid_state");
  });

  it("stores tokens and redirects to settings on success", async () => {
    const req = makeRequest({ code: "valid-code", state: "valid-state" });
    mockExchangeCode.mockResolvedValue({
      access_token: "access",
      refresh_token: "refresh",
      expiry_date: 1700000000000,
      scope: "https://www.googleapis.com/auth/drive.readonly",
    });
    mockGetGoogleUserEmail.mockResolvedValue("user@gmail.com");
    mockStoreTokens.mockResolvedValue(undefined);

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    const location = response.headers.get("location") ?? "";
    expect(location).toContain("google=connected");
    expect(location).toContain("email=user%40gmail.com");
    expect(mockStoreTokens).toHaveBeenCalledWith("user-1", "user@gmail.com", {
      access_token: "access",
      refresh_token: "refresh",
      expiry_date: 1700000000000,
      scope: "https://www.googleapis.com/auth/drive.readonly",
    });
  });

  it("redirects with error=no_refresh_token when refresh token is absent", async () => {
    const req = makeRequest({ code: "valid-code", state: "valid-state" });
    mockExchangeCode.mockResolvedValue({
      access_token: "access",
      refresh_token: null,
      expiry_date: null,
      scope: "",
    });

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "error=no_refresh_token",
    );
  });

  it("redirects with error=exchange_failed when exchange throws", async () => {
    const req = makeRequest({ code: "valid-code", state: "valid-state" });
    mockExchangeCode.mockRejectedValue(
      new Error("Failed to exchange code: invalid_grant"),
    );

    const { GET } = await import("../callback/route");
    const response = await GET(req);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("error=exchange_failed");
  });
});

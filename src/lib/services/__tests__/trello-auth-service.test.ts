import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Encryption — deterministic stubs so we can assert values
// ──────────────────────────────────────────────────────────
vi.mock("@/lib/encryption", () => ({
  encrypt: vi.fn((val: string) => `encrypted:${val}`),
  decrypt: vi.fn((val: string) => val.replace("encrypted:", "")),
}));

// ──────────────────────────────────────────────────────────
// Supabase admin client — chainable query builder mock
// ──────────────────────────────────────────────────────────
type PromiseResolver = (value: { data: unknown; error: unknown }) => void;

function createBuilder(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select",
    "eq",
    "limit",
    "upsert",
    "delete",
    "single",
    "from",
  ];
  for (const method of chainMethods) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: (onFulfilled: PromiseResolver) => Promise<unknown> }).then =
    (onFulfilled: PromiseResolver) =>
      Promise.resolve(resolveValue).then(onFulfilled);
  return builder;
}

let mockAdminResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockBuilder: ReturnType<typeof createBuilder>;
const mockCreateAdminClient = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();

  mockAdminResult = { data: null, error: null };
  mockBuilder = createBuilder(mockAdminResult);

  mockCreateAdminClient.mockImplementation(() => ({
    from: vi.fn(() => mockBuilder),
  }));
});

// ──────────────────────────────────────────────────────────
describe("buildAuthorizeUrl", () => {
  it("returns Trello authorize URL with all required params", async () => {
    const { buildAuthorizeUrl } = await import("../trello-auth-service");
    const url = buildAuthorizeUrl(
      "abc123def456",
      "http://localhost:3002/api/auth/trello/callback",
    );

    expect(url).toContain("https://trello.com/1/authorize");
    expect(url).toContain("response_type=token");
    expect(url).toContain("scope=read%2Cwrite");
    expect(url).toContain("expiration=never");
    expect(url).toContain("key=abc123def456");
    expect(url).toContain(
      "return_url=http%3A%2F%2Flocalhost%3A3002%2Fapi%2Fauth%2Ftrello%2Fcallback",
    );
    expect(url).toContain("name=FractionalBuddy");
  });

  it("uses TRELLO_APP_NAME env var when set", async () => {
    vi.stubEnv("TRELLO_APP_NAME", "CustomApp");
    const { buildAuthorizeUrl } = await import("../trello-auth-service");
    const url = buildAuthorizeUrl("key", "https://example.com");
    expect(url).toContain("name=CustomApp");
  });
});

// ──────────────────────────────────────────────────────────
describe("fetchMemberInfo", () => {
  it("calls Trello members/me endpoint with key, token and fields", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ username: "davidu", fullName: "David U" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { fetchMemberInfo } = await import("../trello-auth-service");
    const result = await fetchMemberInfo("my-api-key", "my-token");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://api.trello.com/1/members/me");
    expect(calledUrl).toContain("key=my-api-key");
    expect(calledUrl).toContain("token=my-token");
    expect(calledUrl).toContain("fields=username%2CfullName");

    expect(result).toEqual({ username: "davidu", fullName: "David U" });
  });

  it("throws on non-200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      }),
    );

    const { fetchMemberInfo } = await import("../trello-auth-service");
    await expect(fetchMemberInfo("bad", "bad")).rejects.toThrow(
      "Trello member info request failed: 401",
    );
  });
});

// ──────────────────────────────────────────────────────────
describe("storeCredentials", () => {
  it("encrypts both token and api key and upserts with correct shape", async () => {
    mockAdminResult.data = null;
    mockAdminResult.error = null;

    const { encrypt } = await import("@/lib/encryption");
    const { storeCredentials } = await import("../trello-auth-service");

    await storeCredentials(
      "user-1",
      "trello-api-key-abc",
      "trello-token-xyz",
      "davidu",
    );

    expect(encrypt).toHaveBeenCalledTimes(2);
    expect(encrypt).toHaveBeenCalledWith("trello-token-xyz");
    expect(encrypt).toHaveBeenCalledWith("trello-api-key-abc");

    expect(mockBuilder.upsert).toHaveBeenCalledTimes(1);
    const upsertArgs = (mockBuilder.upsert as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(upsertArgs[0]).toMatchObject({
      user_id: "user-1",
      provider: "trello",
      account_identifier: "davidu",
      access_token_encrypted: "encrypted:trello-token-xyz",
      metadata: { api_key_encrypted: "encrypted:trello-api-key-abc" },
      is_active: true,
    });
    expect(upsertArgs[1]).toMatchObject({
      onConflict: "user_id,provider,account_identifier",
    });
  });

  it("throws when admin client is unavailable", async () => {
    mockCreateAdminClient.mockReturnValueOnce(null);
    const { storeCredentials } = await import("../trello-auth-service");
    await expect(
      storeCredentials("u", "k", "t", "user"),
    ).rejects.toThrow("Database unavailable");
  });

  it("throws when supabase returns an error", async () => {
    mockAdminResult.error = { message: "db boom" };
    const { storeCredentials } = await import("../trello-auth-service");
    await expect(
      storeCredentials("u", "k", "t", "user"),
    ).rejects.toMatchObject({ message: "db boom" });
  });
});

// ──────────────────────────────────────────────────────────
describe("getCredentials", () => {
  it("returns null when no integration row exists", async () => {
    mockAdminResult.data = null;
    mockAdminResult.error = { code: "PGRST116" };

    const { getCredentials } = await import("../trello-auth-service");
    const result = await getCredentials("user-1");
    expect(result).toBeNull();
  });

  it("returns decrypted credentials when row exists", async () => {
    mockAdminResult.data = {
      access_token_encrypted: "encrypted:real-token",
      account_identifier: "davidu",
      metadata: { api_key_encrypted: "encrypted:real-key" },
    };
    mockAdminResult.error = null;

    const { getCredentials } = await import("../trello-auth-service");
    const result = await getCredentials("user-1");

    expect(result).toEqual({
      apiKey: "real-key",
      token: "real-token",
      username: "davidu",
    });
  });

  it("throws when admin client is unavailable", async () => {
    mockCreateAdminClient.mockReturnValueOnce(null);
    const { getCredentials } = await import("../trello-auth-service");
    await expect(getCredentials("u")).rejects.toThrow("Database unavailable");
  });

  it("throws on non-PGRST116 database error", async () => {
    mockAdminResult.error = { code: "OTHER", message: "explode" };
    const { getCredentials } = await import("../trello-auth-service");
    await expect(getCredentials("u")).rejects.toMatchObject({
      code: "OTHER",
    });
  });
});

// ──────────────────────────────────────────────────────────
describe("disconnect", () => {
  it("deletes integration rows for the user and provider='trello'", async () => {
    mockAdminResult.error = null;
    const { disconnect } = await import("../trello-auth-service");
    await disconnect("user-1");

    expect(mockBuilder.delete).toHaveBeenCalledTimes(1);
    expect(mockBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockBuilder.eq).toHaveBeenCalledWith("provider", "trello");
  });

  it("throws when admin client is unavailable", async () => {
    mockCreateAdminClient.mockReturnValueOnce(null);
    const { disconnect } = await import("../trello-auth-service");
    await expect(disconnect("u")).rejects.toThrow("Database unavailable");
  });

  it("throws when supabase delete returns an error", async () => {
    mockAdminResult.error = { message: "delete boom" };
    const { disconnect } = await import("../trello-auth-service");
    await expect(disconnect("u")).rejects.toMatchObject({
      message: "delete boom",
    });
  });
});

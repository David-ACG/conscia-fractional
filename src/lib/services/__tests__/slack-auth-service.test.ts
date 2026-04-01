import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Encryption — deterministic stubs so we can assert values
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

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();

  process.env.SLACK_CLIENT_ID = "test-client-id";
  process.env.SLACK_CLIENT_SECRET = "test-client-secret";
  process.env.SLACK_REDIRECT_URI =
    "http://localhost:3002/api/auth/slack/callback";
  process.env.SLACK_SIGNING_SECRET = "test-signing-secret";
});

// ──────────────────────────────────────────────────────────
describe("generateAuthUrl", () => {
  it("returns Slack OAuth URL with correct bot scopes and user scope", async () => {
    const { generateAuthUrl } = await import("../slack-auth-service");
    const url = generateAuthUrl("csrf-state-token");

    expect(url).toContain("https://slack.com/oauth/v2/authorize");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("state=csrf-state-token");
    expect(url).toContain(
      "scope=channels%3Aread%2Cchat%3Awrite%2Cgroups%3Aread",
    );
    expect(url).toContain("user_scope=search%3Aread");
    expect(url).toContain(
      "redirect_uri=http%3A%2F%2Flocalhost%3A3002%2Fapi%2Fauth%2Fslack%2Fcallback",
    );
  });

  it("throws when environment variables are missing", async () => {
    delete process.env.SLACK_CLIENT_ID;
    const { generateAuthUrl } = await import("../slack-auth-service");
    expect(() => generateAuthUrl("state")).toThrow(
      "Missing Slack OAuth environment variables",
    );
  });
});

// ──────────────────────────────────────────────────────────
describe("exchangeCode", () => {
  it("returns bot token, user token, team name and team id on success", async () => {
    const mockResponse = {
      ok: true,
      access_token: "xoxb-bot-token-123",
      team: { id: "T12345", name: "ACME Corp" },
      authed_user: { access_token: "xoxp-user-token-456" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      }),
    );

    const { exchangeCode } = await import("../slack-auth-service");
    const result = await exchangeCode("auth-code-xyz");

    expect(result.bot_token).toBe("xoxb-bot-token-123");
    expect(result.user_token).toBe("xoxp-user-token-456");
    expect(result.team_name).toBe("ACME Corp");
    expect(result.team_id).toBe("T12345");
  });

  it("sends correct POST to oauth.v2.access endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        access_token: "xoxb-bot",
        team: { id: "T99", name: "Test Team" },
        authed_user: { access_token: "xoxp-user" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const { exchangeCode } = await import("../slack-auth-service");
    await exchangeCode("my-code");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://slack.com/api/oauth.v2.access",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }),
    );

    const body: string = mockFetch.mock.calls[0][1].body;
    expect(body).toContain("client_id=test-client-id");
    expect(body).toContain("client_secret=test-client-secret");
    expect(body).toContain("code=my-code");
  });

  it("throws when Slack returns ok: false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ ok: false, error: "invalid_code" }),
      }),
    );

    const { exchangeCode } = await import("../slack-auth-service");
    await expect(exchangeCode("bad-code")).rejects.toThrow(
      "Slack OAuth exchange failed: invalid_code",
    );
  });

  it("throws when HTTP request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      }),
    );

    const { exchangeCode } = await import("../slack-auth-service");
    await expect(exchangeCode("any-code")).rejects.toThrow(
      "Slack OAuth request failed: 500",
    );
  });

  it("throws when no bot token returned", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          ok: true,
          team: { id: "T1", name: "Team" },
          authed_user: {},
        }),
      }),
    );

    const { exchangeCode } = await import("../slack-auth-service");
    await expect(exchangeCode("code")).rejects.toThrow(
      "No bot token returned from Slack",
    );
  });

  it("throws when SLACK_CLIENT_SECRET is missing", async () => {
    delete process.env.SLACK_CLIENT_SECRET;
    const { exchangeCode } = await import("../slack-auth-service");
    await expect(exchangeCode("code")).rejects.toThrow(
      "Missing Slack OAuth environment variables",
    );
  });
});

// ──────────────────────────────────────────────────────────
describe("storeTokens", () => {
  it("upserts integration with encrypted bot token and metadata", async () => {
    mockUpsertIntegration.mockResolvedValue({});
    const { encrypt } = await import("@/lib/encryption");

    const { storeTokens } = await import("../slack-auth-service");
    await storeTokens(
      "user-1",
      "xoxb-bot-token",
      "xoxp-user-token",
      "ACME Corp",
      "T12345",
    );

    expect(mockUpsertIntegration).toHaveBeenCalledWith("user-1", {
      provider: "slack",
      account_identifier: "ACME Corp",
      access_token: "xoxb-bot-token",
      scopes: ["channels:read", "chat:write", "groups:read"],
      metadata: {
        team_id: "T12345",
        user_token_encrypted: "encrypted:xoxp-user-token",
      },
    });
    expect(encrypt).toHaveBeenCalledWith("xoxp-user-token");
  });

  it("stores without user_token_encrypted when user token is empty", async () => {
    mockUpsertIntegration.mockResolvedValue({});

    const { storeTokens } = await import("../slack-auth-service");
    await storeTokens("user-1", "xoxb-bot", "", "ACME", "T1");

    const call = mockUpsertIntegration.mock.calls[0][1];
    expect(call.metadata).not.toHaveProperty("user_token_encrypted");
    expect(call.metadata.team_id).toBe("T1");
  });
});

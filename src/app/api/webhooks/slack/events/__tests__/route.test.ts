import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "crypto";
import { verifySlackSignature, POST } from "../route";

// --- Mocks ---

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((v: string) => `decrypted:${v}`),
}));

// WebClient mock using vi.fn() with no initial implementation — set in beforeEach
vi.mock("@slack/web-api", () => ({
  WebClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { WebClient } from "@slack/web-api";

const mockCreateAdminClient = vi.mocked(createAdminClient);
const MockWebClient = vi.mocked(WebClient);

const SIGNING_SECRET = "test_signing_secret_value";

// --- Helpers ---

function makeSignature(
  secret: string,
  timestamp: string,
  body: string,
): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(`v0:${timestamp}:${body}`);
  return `v0=${hmac.digest("hex")}`;
}

function makeRequest(
  body: unknown,
  options?: { secret?: string; timestamp?: number; signature?: string },
): Request {
  const rawBody = JSON.stringify(body);
  const timestamp = String(options?.timestamp ?? Math.floor(Date.now() / 1000));
  const secret = options?.secret ?? SIGNING_SECRET;
  const signature =
    options?.signature ?? makeSignature(secret, timestamp, rawBody);

  return new Request("http://localhost/api/webhooks/slack/events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-slack-signature": signature,
      "x-slack-request-timestamp": timestamp,
    },
    body: rawBody,
  });
}

function makeChain(terminalResult: unknown) {
  const q: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "filter", "single", "insert"]) {
    q[m] = vi.fn();
  }
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  q.filter.mockReturnValue(q);
  q.single.mockResolvedValue(terminalResult);
  return q;
}

function makeMockAdmin(overrides?: {
  integration?: unknown;
  mapping?: unknown;
}) {
  const mockInsert = vi.fn().mockResolvedValue({ error: null });

  const integrationChain = makeChain({
    data: overrides?.integration ?? {
      id: "integration-1",
      user_id: "user-1",
      access_token_encrypted: "enc_token",
      metadata: { team_id: "T123", task_reaction_emoji: "white_check_mark" },
    },
    error: null,
  });

  const mappingChain = makeChain({
    data: overrides?.mapping ?? { crm_customer_id: "customer-1" },
    error: null,
  });

  const mockAdmin = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === "integrations") return integrationChain;
      if (table === "slack_channel_mappings") return mappingChain;
      if (table === "tasks") return { insert: mockInsert };
      return makeChain({ data: null, error: null });
    }),
  };

  mockCreateAdminClient.mockReturnValue(
    mockAdmin as unknown as ReturnType<typeof createAdminClient>,
  );
  return { mockAdmin, mockInsert };
}

function makeWebClientMock(
  messageText = "Hello this is a test message from Slack",
) {
  const instance = {
    conversations: {
      history: vi.fn().mockResolvedValue({
        ok: true,
        messages: [{ text: messageText, ts: "1700000001.000000" }],
      }),
    },
    chat: {
      getPermalink: vi
        .fn()
        .mockResolvedValue({ permalink: "https://slack.com/p/123" }),
      postMessage: vi.fn().mockResolvedValue({ ok: true }),
    },
  };
  // Use a regular function (not arrow) so it works as a constructor
  MockWebClient.mockImplementation(function () {
    return instance;
  } as unknown as typeof WebClient);
  return instance;
}

beforeEach(() => {
  process.env.SLACK_SIGNING_SECRET = SIGNING_SECRET;
  process.env.ENCRYPTION_KEY = "a".repeat(64);
  makeWebClientMock();
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- verifySlackSignature unit tests ---

describe("verifySlackSignature", () => {
  it("returns true for valid signature", () => {
    const timestamp = "1609459200";
    const body = '{"type":"event_callback"}';
    const sig = makeSignature(SIGNING_SECRET, timestamp, body);
    expect(verifySlackSignature(SIGNING_SECRET, sig, timestamp, body)).toBe(
      true,
    );
  });

  it("returns false for invalid signature", () => {
    const timestamp = "1609459200";
    const body = '{"type":"event_callback"}';
    expect(
      verifySlackSignature(SIGNING_SECRET, "v0=invalid", timestamp, body),
    ).toBe(false);
  });

  it("returns false when signature length differs", () => {
    const timestamp = "1609459200";
    const body = '{"type":"event_callback"}';
    expect(
      verifySlackSignature(SIGNING_SECRET, "v0=short", timestamp, body),
    ).toBe(false);
  });
});

// --- POST handler tests ---

describe("POST /api/webhooks/slack/events", () => {
  it("returns 401 for missing/invalid signature", async () => {
    makeMockAdmin();
    const req = makeRequest(
      { type: "event_callback" },
      { signature: "v0=badsig" },
    );
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns 401 for old timestamp (>5 minutes)", async () => {
    makeMockAdmin();
    const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
    const req = makeRequest(
      { type: "event_callback" },
      { timestamp: oldTimestamp },
    );
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("returns url_verification challenge", async () => {
    makeMockAdmin();
    const req = makeRequest({
      type: "url_verification",
      challenge: "test_challenge_value",
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.challenge).toBe("test_challenge_value");
  });

  it("returns 200 for unhandled event types", async () => {
    makeMockAdmin();
    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: { type: "message", text: "Hello" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("returns 200 for reaction_added with matching emoji and creates a task", async () => {
    const { mockInsert } = makeMockAdmin();

    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: {
        type: "reaction_added",
        reaction: "white_check_mark",
        item: { channel: "C001", ts: "1700000001.000000" },
      },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "slack",
        crm_customer_id: "customer-1",
        user_id: "user-1",
      }),
    );
  });

  it("creates task with title truncated to 100 chars", async () => {
    const longText = "a".repeat(150);
    makeWebClientMock(longText);

    const { mockInsert } = makeMockAdmin();

    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: {
        type: "reaction_added",
        reaction: "white_check_mark",
        item: { channel: "C001", ts: "1700000001.000000" },
      },
    });

    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "a".repeat(100),
      }),
    );
  });

  it("creates task with description containing full text and permalink", async () => {
    const { mockInsert } = makeMockAdmin();

    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: {
        type: "reaction_added",
        reaction: "white_check_mark",
        item: { channel: "C001", ts: "1700000001.000000" },
      },
    });

    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        description: expect.stringContaining("Slack permalink:"),
      }),
    );
  });

  it("ignores reaction_added with non-matching emoji", async () => {
    const { mockInsert } = makeMockAdmin();

    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: {
        type: "reaction_added",
        reaction: "thumbsup",
        item: { channel: "C001", ts: "1700000001.000000" },
      },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("links task to correct CRM customer via channel mapping", async () => {
    const { mockInsert } = makeMockAdmin({
      mapping: { crm_customer_id: "customer-xyz" },
    });

    const req = makeRequest({
      type: "event_callback",
      team_id: "T123",
      event: {
        type: "reaction_added",
        reaction: "white_check_mark",
        item: { channel: "C001", ts: "1700000001.000000" },
      },
    });

    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ crm_customer_id: "customer-xyz" }),
    );
  });
});

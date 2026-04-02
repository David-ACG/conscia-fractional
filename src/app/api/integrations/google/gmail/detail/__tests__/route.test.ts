import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockAdminFrom = vi.fn();
const mockGetValidAccessToken = vi.fn();
const mockMessagesGet = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockAdminFrom,
  })),
}));

vi.mock("@/lib/services/google-auth-service", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

vi.mock("googleapis", () => {
  function MockOAuth2() {
    return { setCredentials: vi.fn() };
  }
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      gmail: vi.fn(() => ({
        users: {
          messages: {
            get: (...args: unknown[]) => mockMessagesGet(...args),
          },
        },
      })),
    },
    gmail_v1: {},
  };
});

// Dynamic import path uses brackets — alias via vi.mock would be complex,
// so we import the source file by its absolute module path.
// Vitest resolves the `@/` alias, so this works:
import { GET } from "@/app/api/integrations/google/gmail/detail/[messageId]/route";

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function makeRequest(messageId: string, integrationId: string) {
  return new NextRequest(
    `http://localhost:3002/api/integrations/google/gmail/detail/${messageId}?integration_id=${integrationId}`,
  );
}

function makeParams(messageId: string) {
  return { params: Promise.resolve({ messageId }) };
}

function setupAuthenticatedUser() {
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
}

function setupIntegration(scopes: string[]) {
  mockAdminFrom.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: "int-1", scopes, user_id: "user-1" },
            }),
          }),
        }),
      }),
    }),
  });
}

function makeFullGmailResponse(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: "msg-1",
      snippet: "Hello snippet",
      payload: {
        headers: [
          { name: "Subject", value: "Test Email" },
          { name: "From", value: "alice@test.com" },
          { name: "To", value: "bob@test.com" },
          { name: "Cc", value: "charlie@test.com" },
          { name: "Date", value: "Mon, 01 Jan 2026 10:00:00 +0000" },
        ],
        mimeType: "multipart/alternative",
        parts: [
          {
            mimeType: "text/plain",
            body: {
              data: Buffer.from("Hello plain text").toString("base64url"),
            },
          },
          {
            mimeType: "text/html",
            body: {
              data: Buffer.from("<p>Hello <b>HTML</b></p>").toString(
                "base64url",
              ),
            },
          },
          {
            filename: "report.pdf",
            mimeType: "application/pdf",
            body: { size: 12345, attachmentId: "att-1" },
          },
        ],
      },
      ...overrides,
    },
  };
}

function makeMetadataGmailResponse() {
  return {
    data: {
      id: "msg-1",
      snippet: "Just a snippet preview",
      payload: {
        headers: [
          { name: "Subject", value: "Metadata Email" },
          { name: "From", value: "alice@test.com" },
          { name: "To", value: "bob@test.com" },
          { name: "Date", value: "Mon, 01 Jan 2026 10:00:00 +0000" },
        ],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetValidAccessToken.mockResolvedValue("access-token");
});

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("GET /api/integrations/google/gmail/detail/[messageId]", () => {
  it("returns full body, attachments when gmail.readonly scope", async () => {
    setupAuthenticatedUser();
    setupIntegration(["https://www.googleapis.com/auth/gmail.readonly"]);
    mockMessagesGet.mockResolvedValue(makeFullGmailResponse());

    const req = makeRequest("msg-1", "int-1");
    const res = await GET(req, makeParams("msg-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasFullAccess).toBe(true);
    expect(data.subject).toBe("Test Email");
    expect(data.from).toBe("alice@test.com");
    expect(data.to).toBe("bob@test.com");
    expect(data.cc).toBe("charlie@test.com");
    expect(data.body_text).toBe("Hello plain text");
    expect(data.body_html).toBe("<p>Hello <b>HTML</b></p>");
    expect(data.attachments).toHaveLength(1);
    expect(data.attachments[0]).toEqual({
      filename: "report.pdf",
      mimeType: "application/pdf",
      size: 12345,
      attachmentId: "att-1",
    });
  });

  it("returns metadata-only with upgrade message when gmail.metadata scope", async () => {
    setupAuthenticatedUser();
    setupIntegration(["https://www.googleapis.com/auth/gmail.metadata"]);
    mockMessagesGet.mockResolvedValue(makeMetadataGmailResponse());

    const req = makeRequest("msg-1", "int-1");
    const res = await GET(req, makeParams("msg-1"));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.hasFullAccess).toBe(false);
    expect(data.subject).toBe("Metadata Email");
    expect(data.snippet).toBe("Just a snippet preview");
    expect(data.upgradeMessage).toContain("Upgrade to full Gmail access");
    expect(data.body_html).toBeUndefined();
    expect(data.body_text).toBeUndefined();
  });

  it("handles single-part message (no parts array)", async () => {
    setupAuthenticatedUser();
    setupIntegration(["https://www.googleapis.com/auth/gmail.readonly"]);

    const singlePartResponse = {
      data: {
        id: "msg-2",
        payload: {
          headers: [
            { name: "Subject", value: "Simple" },
            { name: "From", value: "a@b.com" },
            { name: "To", value: "c@d.com" },
            { name: "Date", value: "Mon, 01 Jan 2026 10:00:00 +0000" },
          ],
          mimeType: "text/plain",
          body: {
            data: Buffer.from("Single part body").toString("base64url"),
          },
        },
      },
    };
    mockMessagesGet.mockResolvedValue(singlePartResponse);

    const req = makeRequest("msg-2", "int-1");
    const res = await GET(req, makeParams("msg-2"));
    const data = await res.json();

    expect(data.body_text).toBe("Single part body");
    expect(data.hasFullAccess).toBe(true);
  });

  it("handles single-part HTML message", async () => {
    setupAuthenticatedUser();
    setupIntegration(["https://www.googleapis.com/auth/gmail.readonly"]);

    const singleHtmlResponse = {
      data: {
        id: "msg-3",
        payload: {
          headers: [
            { name: "Subject", value: "HTML Only" },
            { name: "From", value: "a@b.com" },
            { name: "To", value: "c@d.com" },
            { name: "Date", value: "Mon, 01 Jan 2026 10:00:00 +0000" },
          ],
          mimeType: "text/html",
          body: {
            data: Buffer.from("<h1>Hello</h1>").toString("base64url"),
          },
        },
      },
    };
    mockMessagesGet.mockResolvedValue(singleHtmlResponse);

    const req = makeRequest("msg-3", "int-1");
    const res = await GET(req, makeParams("msg-3"));
    const data = await res.json();

    expect(data.body_html).toBe("<h1>Hello</h1>");
    expect(data.hasFullAccess).toBe(true);
  });

  it("decodes base64url correctly (with - and _ chars)", async () => {
    setupAuthenticatedUser();
    setupIntegration(["https://www.googleapis.com/auth/gmail.readonly"]);

    // Text with chars that produce + and / in standard base64
    const text = "Hello world! Special chars: <>&";
    const base64url = Buffer.from(text).toString("base64url");

    const response = {
      data: {
        id: "msg-4",
        payload: {
          headers: [
            { name: "Subject", value: "Encoded" },
            { name: "From", value: "a@b.com" },
            { name: "To", value: "c@d.com" },
            { name: "Date", value: "Mon, 01 Jan 2026 10:00:00 +0000" },
          ],
          mimeType: "text/plain",
          body: { data: base64url },
        },
      },
    };
    mockMessagesGet.mockResolvedValue(response);

    const req = makeRequest("msg-4", "int-1");
    const res = await GET(req, makeParams("msg-4"));
    const data = await res.json();

    expect(data.body_text).toBe(text);
  });

  it("returns 401 for unauthenticated user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = makeRequest("msg-1", "int-1");
    const res = await GET(req, makeParams("msg-1"));

    expect(res.status).toBe(401);
  });

  it("returns 400 when integration_id is missing", async () => {
    setupAuthenticatedUser();

    const req = new NextRequest(
      "http://localhost:3002/api/integrations/google/gmail/detail/msg-1",
    );
    const res = await GET(req, makeParams("msg-1"));

    expect(res.status).toBe(400);
  });
});

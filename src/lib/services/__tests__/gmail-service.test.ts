import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Mock googleapis
// ──────────────────────────────────────────────────────────
const mockMessagesList = vi.fn();
const mockMessagesGet = vi.fn();

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
            list: (...args: unknown[]) => mockMessagesList(...args),
            get: (...args: unknown[]) => mockMessagesGet(...args),
          },
        },
      })),
    },
    gmail_v1: {},
  };
});

import {
  getGmailClient,
  listMessages,
  listMessagesForCustomer,
  hasFullAccess,
} from "../gmail-service";

// Helper: make a fake messages.get response
function makeGetResponse(
  overrides: Partial<{
    id: string;
    threadId: string;
    snippet: string;
    subject: string;
    from: string;
    to: string;
    date: string;
  }> = {},
) {
  const {
    id = "msg-1",
    threadId = "thread-1",
    snippet = "Hello world",
    subject = "Test Subject",
    from = "sender@example.com",
    to = "recipient@example.com",
    date = "Mon, 01 Jan 2026 10:00:00 +0000",
  } = overrides;

  return {
    data: {
      id,
      threadId,
      snippet,
      payload: {
        headers: [
          { name: "Subject", value: subject },
          { name: "From", value: from },
          { name: "To", value: to },
          { name: "Date", value: date },
        ],
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// hasFullAccess
// ──────────────────────────────────────────────────────────
describe("hasFullAccess", () => {
  it("returns true when gmail.readonly scope is present", () => {
    expect(
      hasFullAccess([
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/calendar.readonly",
      ]),
    ).toBe(true);
  });

  it("returns false when only gmail.metadata scope is present", () => {
    expect(
      hasFullAccess(["https://www.googleapis.com/auth/gmail.metadata"]),
    ).toBe(false);
  });

  it("returns false when no gmail scopes are present", () => {
    expect(
      hasFullAccess(["https://www.googleapis.com/auth/calendar.readonly"]),
    ).toBe(false);
  });

  it("returns false for empty scopes array", () => {
    expect(hasFullAccess([])).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// getGmailClient
// ──────────────────────────────────────────────────────────
describe("getGmailClient", () => {
  it("returns a Gmail client without throwing", () => {
    expect(() => getGmailClient("test-token")).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────
// listMessages
// ──────────────────────────────────────────────────────────
describe("listMessages", () => {
  it("calls Gmail API with correct query and format", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg-1" }], nextPageToken: null },
    });
    mockMessagesGet.mockResolvedValue(makeGetResponse());

    const client = getGmailClient("token");
    await listMessages(client, "from:test@example.com", 10);

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        q: "from:test@example.com",
        maxResults: 10,
      }),
    );
    expect(mockMessagesGet).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        id: "msg-1",
        format: "metadata",
        metadataHeaders: ["Subject", "From", "To", "Date"],
      }),
    );
  });

  it("returns empty array when no messages", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [], nextPageToken: null },
    });

    const client = getGmailClient("token");
    const result = await listMessages(client, "from:nobody@example.com");

    expect(result.messages).toEqual([]);
    expect(result.nextPageToken).toBeUndefined();
    expect(mockMessagesGet).not.toHaveBeenCalled();
  });

  it("parses metadata headers correctly", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg-42" }] },
    });
    mockMessagesGet.mockResolvedValue(
      makeGetResponse({
        id: "msg-42",
        subject: "Project Update",
        from: "alice@acme.com",
        to: "bob@acme.com",
        date: "Fri, 10 Jan 2026 09:30:00 +0000",
        snippet: "Here is the latest update...",
      }),
    );

    const client = getGmailClient("token");
    const result = await listMessages(client, "from:alice@acme.com");

    expect(result.messages).toHaveLength(1);
    const msg = result.messages[0];
    expect(msg.id).toBe("msg-42");
    expect(msg.subject).toBe("Project Update");
    expect(msg.from).toBe("alice@acme.com");
    expect(msg.to).toBe("bob@acme.com");
    expect(msg.snippet).toBe("Here is the latest update...");
  });

  it("passes pagination token through", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg-1" }], nextPageToken: "token-abc" },
    });
    mockMessagesGet.mockResolvedValue(makeGetResponse());

    const client = getGmailClient("token");
    const result = await listMessages(client, "query", 20, "prev-token");

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: "prev-token" }),
    );
    expect(result.nextPageToken).toBe("token-abc");
  });

  it("sorts messages newest first", async () => {
    mockMessagesList.mockResolvedValue({
      data: {
        messages: [{ id: "old-msg" }, { id: "new-msg" }],
      },
    });
    mockMessagesGet
      .mockResolvedValueOnce(
        makeGetResponse({
          id: "old-msg",
          date: "Mon, 01 Jan 2024 10:00:00 +0000",
        }),
      )
      .mockResolvedValueOnce(
        makeGetResponse({
          id: "new-msg",
          date: "Mon, 01 Jan 2026 10:00:00 +0000",
        }),
      );

    const client = getGmailClient("token");
    const result = await listMessages(client, "query");

    expect(result.messages[0].id).toBe("new-msg");
    expect(result.messages[1].id).toBe("old-msg");
  });

  it("propagates API errors", async () => {
    mockMessagesList.mockRejectedValue(new Error("API quota exceeded"));

    const client = getGmailClient("token");
    await expect(listMessages(client, "query")).rejects.toThrow(
      "API quota exceeded",
    );
  });
});

// ──────────────────────────────────────────────────────────
// listMessagesForCustomer
// ──────────────────────────────────────────────────────────
describe("listMessagesForCustomer", () => {
  it("builds correct OR query from multiple contact emails", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [] },
    });

    const client = getGmailClient("token");
    await listMessagesForCustomer(client, [
      { email: "alice@acme.com" },
      { email: "bob@acme.com" },
    ]);

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "(from:alice@acme.com OR to:alice@acme.com OR from:bob@acme.com OR to:bob@acme.com)",
      }),
    );
  });

  it("builds correct query for single contact", async () => {
    mockMessagesList.mockResolvedValue({ data: { messages: [] } });

    const client = getGmailClient("token");
    await listMessagesForCustomer(client, [{ email: "single@test.com" }]);

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "(from:single@test.com OR to:single@test.com)",
      }),
    );
  });

  it("returns empty result when no contacts provided", async () => {
    const client = getGmailClient("token");
    const result = await listMessagesForCustomer(client, []);

    expect(result.messages).toEqual([]);
    expect(mockMessagesList).not.toHaveBeenCalled();
  });

  it("returns messages from underlying listMessages", async () => {
    mockMessagesList.mockResolvedValue({
      data: { messages: [{ id: "msg-1" }] },
    });
    mockMessagesGet.mockResolvedValue(makeGetResponse({ id: "msg-1" }));

    const client = getGmailClient("token");
    const result = await listMessagesForCustomer(client, [
      { email: "contact@acme.com" },
    ]);

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].id).toBe("msg-1");
  });

  it("passes pagination token to listMessages", async () => {
    mockMessagesList.mockResolvedValue({ data: { messages: [] } });

    const client = getGmailClient("token");
    await listMessagesForCustomer(
      client,
      [{ email: "a@b.com" }],
      20,
      "page-token-xyz",
    );

    expect(mockMessagesList).toHaveBeenCalledWith(
      expect.objectContaining({ pageToken: "page-token-xyz" }),
    );
  });
});

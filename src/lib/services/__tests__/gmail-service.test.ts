import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Mock googleapis
// ──────────────────────────────────────────────────────────
const mockMessagesList = vi.fn();
const mockMessagesGet = vi.fn();
const mockMessagesSend = vi.fn();
const mockDraftsCreate = vi.fn();

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
            send: (...args: unknown[]) => mockMessagesSend(...args),
          },
          drafts: {
            create: (...args: unknown[]) => mockDraftsCreate(...args),
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
  hasSendAccess,
  sendEmail,
  createDraft,
  _buildRfc2822Message,
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

// ──────────────────────────────────────────────────────────
// hasSendAccess
// ──────────────────────────────────────────────────────────
describe("hasSendAccess", () => {
  it("returns true when gmail.send scope is present", () => {
    expect(
      hasSendAccess([
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
      ]),
    ).toBe(true);
  });

  it("returns false when gmail.send scope is missing", () => {
    expect(
      hasSendAccess(["https://www.googleapis.com/auth/gmail.readonly"]),
    ).toBe(false);
  });

  it("returns false for empty scopes", () => {
    expect(hasSendAccess([])).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// _buildRfc2822Message
// ──────────────────────────────────────────────────────────
describe("_buildRfc2822Message", () => {
  it("builds basic message with required fields", () => {
    const raw = _buildRfc2822Message({
      to: "alice@example.com",
      subject: "Test",
      body: "Hello",
    });

    expect(raw).toContain("To: alice@example.com");
    expect(raw).toContain("Subject: Test");
    expect(raw).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(raw).toContain("MIME-Version: 1.0");
    expect(raw).toContain("Hello");
  });

  it("includes CC and BCC when provided", () => {
    const raw = _buildRfc2822Message({
      to: "alice@example.com",
      cc: "bob@example.com",
      bcc: "charlie@example.com",
      subject: "Test",
      body: "Body",
    });

    expect(raw).toContain("Cc: bob@example.com");
    expect(raw).toContain("Bcc: charlie@example.com");
  });

  it("includes In-Reply-To and References for replies", () => {
    const raw = _buildRfc2822Message({
      to: "alice@example.com",
      subject: "Re: Hello",
      body: "Reply body",
      inReplyTo: "<msg-id-123@mail.gmail.com>",
      references: "<msg-id-123@mail.gmail.com>",
    });

    expect(raw).toContain("In-Reply-To: <msg-id-123@mail.gmail.com>");
    expect(raw).toContain("References: <msg-id-123@mail.gmail.com>");
  });

  it("does not include reply headers when not provided", () => {
    const raw = _buildRfc2822Message({
      to: "alice@example.com",
      subject: "New",
      body: "Body",
    });

    expect(raw).not.toContain("In-Reply-To:");
    expect(raw).not.toContain("References:");
  });
});

// ──────────────────────────────────────────────────────────
// sendEmail
// ──────────────────────────────────────────────────────────
describe("sendEmail", () => {
  it("sends email with correct base64url-encoded raw message", async () => {
    mockMessagesSend.mockResolvedValue({
      data: { id: "sent-msg-1" },
    });

    const client = getGmailClient("token");
    const result = await sendEmail(client, {
      to: "alice@example.com",
      subject: "Test Subject",
      body: "Hello World",
    });

    expect(result.messageId).toBe("sent-msg-1");
    expect(mockMessagesSend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        requestBody: expect.objectContaining({
          raw: expect.any(String),
        }),
      }),
    );

    // Verify the raw content is valid base64url
    const callArgs = mockMessagesSend.mock.calls[0][0];
    const decoded = Buffer.from(callArgs.requestBody.raw, "base64url").toString(
      "utf-8",
    );
    expect(decoded).toContain("To: alice@example.com");
    expect(decoded).toContain("Subject: Test Subject");
    expect(decoded).toContain("Hello World");
  });

  it("includes threadId when replying", async () => {
    mockMessagesSend.mockResolvedValue({
      data: { id: "sent-msg-2" },
    });

    const client = getGmailClient("token");
    await sendEmail(client, {
      to: "alice@example.com",
      subject: "Re: Thread",
      body: "Reply",
      threadId: "thread-abc",
      inReplyTo: "<original@mail.gmail.com>",
      references: "<original@mail.gmail.com>",
    });

    expect(mockMessagesSend).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          threadId: "thread-abc",
        }),
      }),
    );

    const callArgs = mockMessagesSend.mock.calls[0][0];
    const decoded = Buffer.from(callArgs.requestBody.raw, "base64url").toString(
      "utf-8",
    );
    expect(decoded).toContain("In-Reply-To: <original@mail.gmail.com>");
    expect(decoded).toContain("References: <original@mail.gmail.com>");
  });

  it("propagates API errors", async () => {
    mockMessagesSend.mockRejectedValue(new Error("Rate limit exceeded"));

    const client = getGmailClient("token");
    await expect(
      sendEmail(client, {
        to: "alice@example.com",
        subject: "Test",
        body: "Body",
      }),
    ).rejects.toThrow("Rate limit exceeded");
  });
});

// ──────────────────────────────────────────────────────────
// createDraft
// ──────────────────────────────────────────────────────────
describe("createDraft", () => {
  it("creates draft via Gmail API", async () => {
    mockDraftsCreate.mockResolvedValue({
      data: { id: "draft-1" },
    });

    const client = getGmailClient("token");
    const result = await createDraft(client, {
      to: "bob@example.com",
      subject: "Draft Subject",
      body: "Draft body",
    });

    expect(result.draftId).toBe("draft-1");
    expect(mockDraftsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "me",
        requestBody: expect.objectContaining({
          message: expect.objectContaining({
            raw: expect.any(String),
          }),
        }),
      }),
    );
  });

  it("includes threadId in draft when provided", async () => {
    mockDraftsCreate.mockResolvedValue({
      data: { id: "draft-2" },
    });

    const client = getGmailClient("token");
    await createDraft(client, {
      to: "bob@example.com",
      subject: "Re: Thread",
      body: "Reply draft",
      threadId: "thread-xyz",
    });

    expect(mockDraftsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          message: expect.objectContaining({
            threadId: "thread-xyz",
          }),
        }),
      }),
    );
  });
});

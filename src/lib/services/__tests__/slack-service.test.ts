import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mock @slack/web-api ---
// Using vi.hoisted ensures mock instance is ready before vi.mock factory runs

const mockInstance = vi.hoisted(() => ({
  conversations: {
    list: vi.fn(),
    history: vi.fn(),
  },
  users: {
    info: vi.fn(),
  },
  search: {
    messages: vi.fn(),
  },
}));

vi.mock("@slack/web-api", () => ({
  WebClient: class MockWebClient {
    conversations = mockInstance.conversations;
    users = mockInstance.users;
    search = mockInstance.search;
  },
}));

const mockConversationsList = mockInstance.conversations.list;
const mockConversationsHistory = mockInstance.conversations.history;
const mockUsersInfo = mockInstance.users.info;
const mockSearchMessages = mockInstance.search.messages;

import {
  listChannels,
  getChannelMessages,
  searchMessages,
} from "../slack-service";

beforeEach(() => {
  vi.clearAllMocks();
});

// --- listChannels ---

describe("listChannels", () => {
  it("returns sorted channels from conversations.list", async () => {
    mockConversationsList.mockResolvedValue({
      ok: true,
      channels: [
        { id: "C002", name: "zebra", is_private: false },
        { id: "C001", name: "alpha", is_private: true },
      ],
      response_metadata: { next_cursor: "" },
    });

    const result = await listChannels("xoxb-test-token");

    expect(result).toEqual([
      { id: "C001", name: "alpha", is_private: true },
      { id: "C002", name: "zebra", is_private: false },
    ]);
  });

  it("paginates using cursor", async () => {
    mockConversationsList
      .mockResolvedValueOnce({
        ok: true,
        channels: [{ id: "C001", name: "alpha", is_private: false }],
        response_metadata: { next_cursor: "cursor-abc" },
      })
      .mockResolvedValueOnce({
        ok: true,
        channels: [{ id: "C002", name: "beta", is_private: false }],
        response_metadata: { next_cursor: "" },
      });

    const result = await listChannels("xoxb-test-token");

    expect(mockConversationsList).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.name)).toEqual(["alpha", "beta"]);
  });

  it("skips channels without id or name", async () => {
    mockConversationsList.mockResolvedValue({
      ok: true,
      channels: [
        { id: "C001", name: "valid", is_private: false },
        { id: "C002", name: undefined },
        { id: undefined, name: "no-id" },
      ],
      response_metadata: { next_cursor: "" },
    });

    const result = await listChannels("xoxb-test-token");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("valid");
  });

  it("throws when conversations.list returns ok: false", async () => {
    mockConversationsList.mockResolvedValue({
      ok: false,
      error: "missing_scope",
    });

    await expect(listChannels("xoxb-bad-token")).rejects.toThrow(
      "missing_scope",
    );
  });
});

// --- getChannelMessages ---

describe("getChannelMessages", () => {
  it("returns messages with user names", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: true,
      messages: [
        { ts: "1700000002.000000", user: "U001", text: "Hello world" },
        { ts: "1700000001.000000", user: "U002", text: "Second message" },
      ],
    });

    mockUsersInfo
      .mockResolvedValueOnce({
        ok: true,
        user: {
          profile: { display_name: "Alice", real_name: "" },
          name: "alice",
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        user: {
          profile: { display_name: "", real_name: "Bob Smith" },
          name: "bob",
        },
      });

    const result = await getChannelMessages("xoxb-test-token", "C001");

    expect(result).toHaveLength(2);
    const alice = result.find((m) => m.user === "U001");
    const bob = result.find((m) => m.user === "U002");
    expect(alice?.user_name).toBe("Alice");
    expect(bob?.user_name).toBe("Bob Smith");
  });

  it("returns messages sorted newest first", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: true,
      messages: [
        { ts: "1700000001.000000", user: "U001", text: "Older" },
        { ts: "1700000003.000000", user: "U001", text: "Newer" },
      ],
    });

    mockUsersInfo.mockResolvedValue({
      ok: true,
      user: {
        profile: { display_name: "Alice", real_name: "" },
        name: "alice",
      },
    });

    const result = await getChannelMessages("xoxb-test-token", "C001");

    expect(result[0].ts).toBe("1700000003.000000");
    expect(result[1].ts).toBe("1700000001.000000");
  });

  it("caches user lookups — calls users.info only once per unique user", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: true,
      messages: [
        { ts: "1700000003.000000", user: "U001", text: "Message 1" },
        { ts: "1700000002.000000", user: "U001", text: "Message 2" },
        { ts: "1700000001.000000", user: "U002", text: "Message 3" },
      ],
    });

    mockUsersInfo.mockResolvedValue({
      ok: true,
      user: {
        profile: { display_name: "Alice", real_name: "" },
        name: "alice",
      },
    });

    await getChannelMessages("xoxb-test-token", "C001");

    expect(mockUsersInfo).toHaveBeenCalledTimes(2);
  });

  it("falls back to user ID when users.info throws", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: true,
      messages: [{ ts: "1700000001.000000", user: "U999", text: "Hi" }],
    });

    mockUsersInfo.mockRejectedValue(new Error("user_not_found"));

    const result = await getChannelMessages("xoxb-test-token", "C001");

    expect(result[0].user_name).toBe("U999");
  });

  it("throws when conversations.history returns ok: false", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: false,
      error: "channel_not_found",
    });

    await expect(
      getChannelMessages("xoxb-test-token", "C_INVALID"),
    ).rejects.toThrow("channel_not_found");
  });

  it("skips messages without ts or text", async () => {
    mockConversationsHistory.mockResolvedValue({
      ok: true,
      messages: [
        { ts: "1700000001.000000", user: "U001", text: "Valid" },
        { ts: undefined, user: "U001", text: "No ts" },
        { ts: "1700000000.000000", user: "U001", text: undefined },
      ],
    });

    mockUsersInfo.mockResolvedValue({
      ok: true,
      user: { profile: { display_name: "Alice" }, name: "alice" },
    });

    const result = await getChannelMessages("xoxb-test-token", "C001");
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Valid");
  });
});

// --- searchMessages ---

describe("searchMessages", () => {
  it("returns search results with permalinks", async () => {
    mockSearchMessages.mockResolvedValue({
      ok: true,
      messages: {
        matches: [
          {
            ts: "1700000001.000000",
            user: "U001",
            username: "alice",
            text: "Found message",
            permalink: "https://slack.com/archives/C001/p1700000001",
          },
        ],
      },
    });

    const result = await searchMessages("xoxp-user-token", "project update");

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe("Found message");
    expect(result[0].permalink).toBe(
      "https://slack.com/archives/C001/p1700000001",
    );
    expect(result[0].user_name).toBe("alice");
  });

  it("prepends in:#channel-name when channelName is provided", async () => {
    mockSearchMessages.mockResolvedValue({
      ok: true,
      messages: { matches: [] },
    });

    await searchMessages("xoxp-user-token", "meeting notes", "general");

    expect(mockSearchMessages).toHaveBeenCalledWith({
      query: "in:#general meeting notes",
      count: 20,
    });
  });

  it("does not prepend channel filter when channelName is omitted", async () => {
    mockSearchMessages.mockResolvedValue({
      ok: true,
      messages: { matches: [] },
    });

    await searchMessages("xoxp-user-token", "hello");

    expect(mockSearchMessages).toHaveBeenCalledWith({
      query: "hello",
      count: 20,
    });
  });

  it("throws when search.messages returns ok: false", async () => {
    mockSearchMessages.mockResolvedValue({
      ok: false,
      error: "not_allowed_token_type",
    });

    await expect(searchMessages("xoxb-bot-token", "query")).rejects.toThrow(
      "not_allowed_token_type",
    );
  });

  it("returns empty array when no matches", async () => {
    mockSearchMessages.mockResolvedValue({
      ok: true,
      messages: { matches: [] },
    });

    const result = await searchMessages("xoxp-user-token", "nonexistent");
    expect(result).toEqual([]);
  });
});

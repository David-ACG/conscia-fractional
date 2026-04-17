import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Task } from "@/lib/types";

// ──────────────────────────────────────────────────────────
// Mock trello-auth-service (source of credentials)
// ──────────────────────────────────────────────────────────
const mockGetCredentials = vi.fn();
vi.mock("@/lib/services/trello-auth-service", () => ({
  getCredentials: (userId: string) => mockGetCredentials(userId),
}));

// ──────────────────────────────────────────────────────────
// Mock supabase admin client — chainable query builder
// ──────────────────────────────────────────────────────────
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
const mockCreateAdminClient = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

// ──────────────────────────────────────────────────────────
// Test helpers
// ──────────────────────────────────────────────────────────
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    client_id: "client-1",
    crm_customer_id: null,
    title: "Test task",
    description: "Test description",
    status: "todo",
    priority: "medium",
    assignee: "David",
    assignee_type: "self",
    due_date: "2026-04-20",
    meeting_id: null,
    confidence: null,
    source_quote: null,
    trello_card_id: null,
    created_at: "2026-04-17T00:00:00Z",
    updated_at: "2026-04-17T00:00:00Z",
    ...overrides,
  };
}

function mockResponse({
  ok = true,
  status = 200,
  headers = {},
  body = {},
}: {
  ok?: boolean;
  status?: number;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) =>
        headers[name] ?? headers[name.toLowerCase()] ?? null,
    },
    json: async () => body,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCredentials.mockResolvedValue({
    apiKey: "key-abc",
    token: "token-xyz",
    username: "davidu",
  });
  mockUpdateEq.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ──────────────────────────────────────────────────────────
describe("listBoards", () => {
  it("builds correct URL query string and returns mapped array", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        body: [
          { id: "b1", name: "Board 1", url: "https://trello.com/b/b1", extra: "x" },
          { id: "b2", name: "Board 2", url: "https://trello.com/b/b2" },
        ],
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { listBoards } = await import("../trello-export-service");
    const boards = await listBoards("user-1");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain("https://api.trello.com/1/members/me/boards");
    expect(calledUrl).toContain("key=key-abc");
    expect(calledUrl).toContain("token=token-xyz");
    expect(calledUrl).toContain("filter=open");
    expect(calledUrl).toContain("fields=name%2Curl");

    expect(boards).toEqual([
      { id: "b1", name: "Board 1", url: "https://trello.com/b/b1" },
      { id: "b2", name: "Board 2", url: "https://trello.com/b/b2" },
    ]);
  });

  it("throws when credentials are missing", async () => {
    mockGetCredentials.mockResolvedValue(null);
    const { listBoards } = await import("../trello-export-service");
    await expect(listBoards("user-1")).rejects.toThrow("Trello not connected");
  });

  it("throws on non-2xx response with redacted URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ ok: false, status: 401 })),
    );
    const { listBoards } = await import("../trello-export-service");
    await expect(listBoards("user-1")).rejects.toThrow(
      /Trello listBoards failed: 401/,
    );
    await expect(listBoards("user-1")).rejects.not.toThrow(/key=/);
  });
});

// ──────────────────────────────────────────────────────────
describe("listLists", () => {
  it("builds correct URL query string and returns mapped array", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      mockResponse({
        body: [
          { id: "l1", name: "To Do", pos: 1000 },
          { id: "l2", name: "Doing", pos: 2000 },
        ],
      }),
    );
    vi.stubGlobal("fetch", mockFetch);

    const { listLists } = await import("../trello-export-service");
    const lists = await listLists("user-1", "board-xyz");

    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain(
      "https://api.trello.com/1/boards/board-xyz/lists",
    );
    expect(calledUrl).toContain("key=key-abc");
    expect(calledUrl).toContain("token=token-xyz");
    expect(calledUrl).toContain("fields=name%2Cpos");

    expect(lists).toEqual([
      { id: "l1", name: "To Do", pos: 1000 },
      { id: "l2", name: "Doing", pos: 2000 },
    ]);
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — happy path", () => {
  it("creates all cards mapped to correct list based on status, writes trello_card_id back", async () => {
    const postedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      postedUrls.push(url);
      const parsed = new URL(url);
      const idList = parsed.searchParams.get("idList");
      return mockResponse({ body: { id: `card-for-${idList}` } });
    });
    vi.stubGlobal("fetch", mockFetch);

    const tasks = [
      makeTask({ id: "t-todo", title: "A", status: "todo" }),
      makeTask({ id: "t-prog", title: "B", status: "in_progress" }),
      makeTask({ id: "t-block", title: "C", status: "blocked" }),
      makeTask({ id: "t-done", title: "D", status: "done" }),
    ];

    const { exportTasks } = await import("../trello-export-service");
    const result = await exportTasks({
      userId: "user-1",
      tasks,
      statusToListMap: {
        todo: "LIST-TODO",
        in_progress: "LIST-PROG",
        blocked: "LIST-BLOCK",
        done: "LIST-DONE",
      },
      mode: "overwrite",
    });

    expect(result.created).toBe(4);
    expect(result.skipped).toBe(0);
    expect(result.failed).toEqual([]);

    const listsUsed = postedUrls.map(
      (u) => new URL(u).searchParams.get("idList"),
    );
    expect(listsUsed).toEqual([
      "LIST-TODO",
      "LIST-PROG",
      "LIST-BLOCK",
      "LIST-DONE",
    ]);

    expect(mockUpdate).toHaveBeenCalledTimes(4);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, {
      trello_card_id: "card-for-LIST-TODO",
    });
    expect(mockUpdateEq).toHaveBeenNthCalledWith(1, "id", "t-todo");
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — mode behaviour", () => {
  it("skip-exported skips tasks with existing trello_card_id", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ body: { id: "new-card" } }));
    vi.stubGlobal("fetch", mockFetch);

    const tasks = [
      makeTask({ id: "t-already", trello_card_id: "existing-card-xyz" }),
      makeTask({ id: "t-new", trello_card_id: null }),
    ];

    const { exportTasks } = await import("../trello-export-service");
    const result = await exportTasks({
      userId: "user-1",
      tasks,
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "skip-exported",
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("overwrite re-creates tasks that already had a trello_card_id (new id wins)", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ body: { id: "fresh-card-id" } }));
    vi.stubGlobal("fetch", mockFetch);

    const tasks = [
      makeTask({ id: "t-already", trello_card_id: "existing-card-xyz" }),
    ];

    const { exportTasks } = await import("../trello-export-service");
    const result = await exportTasks({
      userId: "user-1",
      tasks,
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(result.created).toBe(1);
    expect(result.skipped).toBe(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockUpdate).toHaveBeenCalledWith({
      trello_card_id: "fresh-card-id",
    });
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — throttle", () => {
  it("10 cards take ≥ 1125 ms of advanced fake time", async () => {
    vi.useFakeTimers();

    const baseTime = Date.now();
    const postTimes: number[] = [];
    const mockFetch = vi.fn().mockImplementation(async () => {
      postTimes.push(Date.now() - baseTime);
      return mockResponse({ body: { id: `card-${postTimes.length}` } });
    });
    vi.stubGlobal("fetch", mockFetch);

    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, title: `Task ${i}` }),
    );

    const { exportTasks } = await import("../trello-export-service");
    const promise = exportTasks({
      userId: "user-1",
      tasks,
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.created).toBe(10);
    expect(postTimes).toHaveLength(10);
    expect(postTimes[9]! - postTimes[0]!).toBeGreaterThanOrEqual(1125);
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — 429 handling", () => {
  it("429 then 200 succeeds and honours Retry-After: 2 seconds", async () => {
    vi.useFakeTimers();
    const base = Date.now();
    const callTimes: number[] = [];

    const mockFetch = vi
      .fn()
      .mockImplementationOnce(async () => {
        callTimes.push(Date.now() - base);
        return mockResponse({
          ok: false,
          status: 429,
          headers: { "Retry-After": "2" },
        });
      })
      .mockImplementationOnce(async () => {
        callTimes.push(Date.now() - base);
        return mockResponse({ body: { id: "card-after-retry" } });
      });
    vi.stubGlobal("fetch", mockFetch);

    const { exportTasks } = await import("../trello-export-service");
    const promise = exportTasks({
      userId: "user-1",
      tasks: [makeTask({ id: "t-429" })],
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.created).toBe(1);
    expect(result.failed).toEqual([]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(callTimes[1]! - callTimes[0]!).toBeGreaterThanOrEqual(2000);
  });

  it("429 twice → failed with rate_limited, subsequent tasks still attempted", async () => {
    vi.useFakeTimers();
    const mockFetch = vi
      .fn()
      .mockImplementationOnce(async () =>
        mockResponse({
          ok: false,
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      )
      .mockImplementationOnce(async () =>
        mockResponse({
          ok: false,
          status: 429,
          headers: { "Retry-After": "1" },
        }),
      )
      .mockImplementationOnce(async () =>
        mockResponse({ body: { id: "card-2" } }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const tasks = [
      makeTask({ id: "t-a", title: "A" }),
      makeTask({ id: "t-b", title: "B" }),
    ];

    const { exportTasks } = await import("../trello-export-service");
    const promise = exportTasks({
      userId: "user-1",
      tasks,
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.created).toBe(1);
    expect(result.failed).toEqual([
      { taskId: "t-a", reason: "rate_limited" },
    ]);
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — non-2xx non-429", () => {
  it("400 Bad Request → task in failed with http_400", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 400, body: { message: "bad" } }),
      );
    vi.stubGlobal("fetch", mockFetch);

    const { exportTasks } = await import("../trello-export-service");
    const result = await exportTasks({
      userId: "user-1",
      tasks: [makeTask({ id: "t-bad" })],
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(result.created).toBe(0);
    expect(result.failed).toEqual([{ taskId: "t-bad", reason: "http_400" }]);
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — description composition", () => {
  it("includes FB link, priority, owner, due in card description", async () => {
    let capturedDesc: string | null = null;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedDesc = new URL(url).searchParams.get("desc");
      return mockResponse({ body: { id: "card-1" } });
    });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://fb.example.com");

    const task = makeTask({
      id: "task-xyz",
      description: "Buy milk",
      priority: "high",
      assignee: "Alice",
      due_date: "2026-05-01",
    });

    const { exportTasks } = await import("../trello-export-service");
    await exportTasks({
      userId: "user-1",
      tasks: [task],
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(capturedDesc).toBeTruthy();
    expect(capturedDesc!).toContain("Buy milk");
    expect(capturedDesc!).toContain("Priority: high");
    expect(capturedDesc!).toContain("Owner: Alice");
    expect(capturedDesc!).toContain("Due: 2026-05-01");
    expect(capturedDesc!).toContain(
      "https://fb.example.com/tasks?id=task-xyz",
    );
    expect(capturedDesc!).toContain("Exported from FractionalBuddy");
  });

  it("uses em-dash for missing assignee and due", async () => {
    let capturedDesc: string | null = null;
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedDesc = new URL(url).searchParams.get("desc");
      return mockResponse({ body: { id: "card-1" } });
    });
    vi.stubGlobal("fetch", mockFetch);

    const task = makeTask({
      id: "t-nulls",
      description: null,
      assignee: null,
      due_date: null,
      priority: "low",
    });

    const { exportTasks } = await import("../trello-export-service");
    await exportTasks({
      userId: "user-1",
      tasks: [task],
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(capturedDesc!).toContain("Owner: —");
    expect(capturedDesc!).toContain("Due: —");
    expect(capturedDesc!).toContain("Priority: low");
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasks — db persistence failure", () => {
  it("card created but DB update fails → counted created + failed warning", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(mockResponse({ body: { id: "created-card" } }));
    vi.stubGlobal("fetch", mockFetch);
    mockUpdateEq.mockResolvedValueOnce({ error: { message: "db boom" } });

    const { exportTasks } = await import("../trello-export-service");
    const result = await exportTasks({
      userId: "user-1",
      tasks: [makeTask({ id: "t-persist-fail" })],
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(result.created).toBe(1);
    expect(result.failed).toEqual([
      { taskId: "t-persist-fail", reason: "card_created_but_not_persisted" },
    ]);
  });
});

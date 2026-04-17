import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Mocks — set up before dynamic imports
// ──────────────────────────────────────────────────────────
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

const mockSelectChain = {
  in: vi.fn().mockReturnThis(),
  eq: vi.fn(),
};
const mockSelect = vi.fn(() => mockSelectChain);
const mockFrom = vi.fn(() => ({ select: mockSelect }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

const mockGetActiveClientId = vi.fn();
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: () => mockGetActiveClientId(),
}));

const mockGetCredentials = vi.fn();
vi.mock("@/lib/services/trello-auth-service", () => ({
  getCredentials: (userId: string) => mockGetCredentials(userId),
}));

const mockListBoards = vi.fn();
const mockListLists = vi.fn();
const mockExportTasks = vi.fn();
vi.mock("@/lib/services/trello-export-service", () => ({
  listBoards: (userId: string) => mockListBoards(userId),
  listLists: (userId: string, boardId: string) =>
    mockListLists(userId, boardId),
  exportTasks: (params: unknown) => mockExportTasks(params),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mockGetActiveClientId.mockResolvedValue("client-123");
  mockGetCredentials.mockResolvedValue({
    apiKey: "k",
    token: "t",
    username: "u",
  });
  mockSelectChain.eq.mockResolvedValue({ data: [], error: null });
});

// ──────────────────────────────────────────────────────────
describe("listTrelloBoardsAction", () => {
  it("returns boards on success", async () => {
    mockListBoards.mockResolvedValue([
      { id: "b1", name: "Board", url: "u" },
    ]);
    const { listTrelloBoardsAction } = await import("../tasks-export");
    const result = await listTrelloBoardsAction();
    expect(result).toEqual({
      boards: [{ id: "b1", name: "Board", url: "u" }],
    });
  });

  it("returns Trello not connected when no credentials", async () => {
    mockGetCredentials.mockResolvedValue(null);
    const { listTrelloBoardsAction } = await import("../tasks-export");
    const result = await listTrelloBoardsAction();
    expect(result).toEqual({ error: "Trello not connected" });
  });

  it("returns Not authenticated when no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { listTrelloBoardsAction } = await import("../tasks-export");
    const result = await listTrelloBoardsAction();
    expect(result).toEqual({ error: "Not authenticated" });
  });
});

// ──────────────────────────────────────────────────────────
describe("listTrelloListsAction", () => {
  it("returns lists for board", async () => {
    mockListLists.mockResolvedValue([{ id: "l1", name: "A", pos: 1 }]);
    const { listTrelloListsAction } = await import("../tasks-export");
    const result = await listTrelloListsAction("board-1");
    expect(mockListLists).toHaveBeenCalledWith("user-1", "board-1");
    expect(result).toEqual({
      lists: [{ id: "l1", name: "A", pos: 1 }],
    });
  });

  it("returns error when credentials missing", async () => {
    mockGetCredentials.mockResolvedValue(null);
    const { listTrelloListsAction } = await import("../tasks-export");
    const result = await listTrelloListsAction("board-1");
    expect(result).toEqual({ error: "Trello not connected" });
  });
});

// ──────────────────────────────────────────────────────────
describe("exportTasksToTrelloAction", () => {
  it("returns Trello not connected when no credentials", async () => {
    mockGetCredentials.mockResolvedValue(null);
    const { exportTasksToTrelloAction } = await import("../tasks-export");
    const result = await exportTasksToTrelloAction({
      taskIds: ["t1"],
      boardId: "b1",
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "skip-exported",
    });
    expect(result).toEqual({ error: "Trello not connected" });
    expect(mockExportTasks).not.toHaveBeenCalled();
  });

  it("happy path — passes tasks loaded from DB to exportTasks and returns result", async () => {
    const dbTasks = [
      { id: "t1", client_id: "client-123", title: "A", status: "todo" },
      { id: "t2", client_id: "client-123", title: "B", status: "done" },
    ];
    mockSelectChain.eq.mockResolvedValue({ data: dbTasks, error: null });
    mockExportTasks.mockResolvedValue({
      created: 2,
      skipped: 0,
      failed: [],
    });

    const { exportTasksToTrelloAction } = await import("../tasks-export");
    const result = await exportTasksToTrelloAction({
      taskIds: ["t1", "t2"],
      boardId: "b1",
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(mockExportTasks).toHaveBeenCalledTimes(1);
    const call = mockExportTasks.mock.calls[0]![0] as {
      tasks: typeof dbTasks;
      userId: string;
      mode: string;
    };
    expect(call.userId).toBe("user-1");
    expect(call.mode).toBe("overwrite");
    expect(call.tasks).toEqual(dbTasks);
    expect(result).toEqual({ result: { created: 2, skipped: 0, failed: [] } });
  });

  it("task IDs outside active client are filtered out (client_id eq applied before export)", async () => {
    const filteredTasks = [
      { id: "t1", client_id: "client-123", title: "A", status: "todo" },
    ];
    mockSelectChain.eq.mockResolvedValue({
      data: filteredTasks,
      error: null,
    });
    mockExportTasks.mockResolvedValue({
      created: 1,
      skipped: 0,
      failed: [],
    });

    const { exportTasksToTrelloAction } = await import("../tasks-export");
    const result = await exportTasksToTrelloAction({
      taskIds: ["t1", "t-from-other-client"],
      boardId: "b1",
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "skip-exported",
    });

    expect(mockSelectChain.in).toHaveBeenCalledWith("id", [
      "t1",
      "t-from-other-client",
    ]);
    expect(mockSelectChain.eq).toHaveBeenCalledWith("client_id", "client-123");

    const call = mockExportTasks.mock.calls[0]![0] as { tasks: unknown[] };
    expect(call.tasks).toHaveLength(1);
    expect(result.result?.created).toBe(1);
  });

  it("empty taskIds short-circuits without hitting DB or Trello", async () => {
    const { exportTasksToTrelloAction } = await import("../tasks-export");
    const result = await exportTasksToTrelloAction({
      taskIds: [],
      boardId: "b1",
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });

    expect(result).toEqual({ result: { created: 0, skipped: 0, failed: [] } });
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockExportTasks).not.toHaveBeenCalled();
  });

  it("returns error when no active client", async () => {
    mockGetActiveClientId.mockResolvedValue(null);
    const { exportTasksToTrelloAction } = await import("../tasks-export");
    const result = await exportTasksToTrelloAction({
      taskIds: ["t1"],
      boardId: "b1",
      statusToListMap: {
        todo: "L1",
        in_progress: "L1",
        blocked: "L1",
        done: "L1",
      },
      mode: "overwrite",
    });
    expect(result).toEqual({ error: "No active client selected" });
  });
});

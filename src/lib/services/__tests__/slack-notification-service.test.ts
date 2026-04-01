import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import type {
  MeetingSummaryInput,
  TaskUpdateInput,
  TaskAction,
} from "../slack-service";

// ─── Hoisted mocks (must be before vi.mock factories) ────────────────

const {
  mockAdminFrom,
  mockPostMessage,
  mockFormatMeetingSummary,
  mockFormatTaskUpdate,
} = vi.hoisted(() => {
  const mockAdminFrom = vi.fn();
  const mockPostMessage = vi.fn();
  const mockFormatMeetingSummary = vi.fn(() => ({
    text: "Meeting summary: Test Meeting",
    blocks: [{ type: "header" }],
  }));
  const mockFormatTaskUpdate = vi.fn(
    (task: { title: string }, action: string) => ({
      text: `Task ${action}: ${task.title}`,
      blocks: [{ type: "section" }],
    }),
  );
  return {
    mockAdminFrom,
    mockPostMessage,
    mockFormatMeetingSummary,
    mockFormatTaskUpdate,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
}));

vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => `decrypted:${val}`),
}));

vi.mock("@/lib/services/slack-service", () => ({
  postMessage: mockPostMessage,
  formatMeetingSummary: mockFormatMeetingSummary,
  formatTaskUpdate: mockFormatTaskUpdate,
}));

import {
  notifyMeetingProcessed,
  notifyTaskCreated,
  notifyTaskCompleted,
} from "../slack-notification-service";

// ─── Real implementations for formatter unit tests ───────────────────

let realFormatMeetingSummary: (m: MeetingSummaryInput) => {
  text: string;
  blocks: unknown[];
};
let realFormatTaskUpdate: (
  t: TaskUpdateInput,
  action: TaskAction,
) => { text: string; blocks: unknown[] };

beforeAll(async () => {
  const actual =
    await vi.importActual<typeof import("../slack-service")>(
      "../slack-service",
    );
  realFormatMeetingSummary = actual.formatMeetingSummary;
  realFormatTaskUpdate = actual.formatTaskUpdate;
});

// ─── Helpers ─────────────────────────────────────────────────────────

function buildQueryChain(result: { data: unknown; error: unknown }) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── notifyMeetingProcessed ──────────────────────────────────────────

describe("notifyMeetingProcessed", () => {
  it("posts formatted summary to the correct channel", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "m1",
            title: "Test Meeting",
            meeting_date: "2026-04-01T10:00:00Z",
            attendees: [{ name: "Alice" }, { name: "Bob" }],
            summary: "Good discussion",
            action_items: [{ title: "Fix bug", assignee: "Alice" }],
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "int1",
            access_token_encrypted: "enc-bot-token",
            metadata: {},
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: { channel_id: "C_GENERAL" },
          error: null,
        }),
      );

    await notifyMeetingProcessed("m1");

    expect(mockFormatMeetingSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Test Meeting",
        participants: ["Alice", "Bob"],
        action_items: [{ title: "Fix bug", assignee: "Alice" }],
      }),
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      "decrypted:enc-bot-token",
      "C_GENERAL",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("silently returns when no crm_customer_id", async () => {
    mockAdminFrom.mockReturnValueOnce(
      buildQueryChain({
        data: {
          id: "m2",
          title: "Meeting",
          meeting_date: "2026-04-01",
          attendees: [],
          summary: "",
          action_items: [],
          crm_customer_id: null,
        },
        error: null,
      }),
    );

    await notifyMeetingProcessed("m2");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("silently returns when no Slack integration", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "m3",
            title: "Meeting",
            meeting_date: "2026-04-01",
            attendees: [],
            summary: "",
            action_items: [],
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({ data: null, error: { code: "PGRST116" } }),
      );

    await notifyMeetingProcessed("m3");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("silently returns when no channel mapping", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "m4",
            title: "Meeting",
            meeting_date: "2026-04-01",
            attendees: [],
            summary: "",
            action_items: [],
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "int1",
            access_token_encrypted: "enc",
            metadata: {},
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({ data: null, error: { code: "PGRST116" } }),
      );

    await notifyMeetingProcessed("m4");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("silently returns when notify_meeting_summaries is false", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "m5",
            title: "Meeting",
            meeting_date: "2026-04-01",
            attendees: [],
            summary: "",
            action_items: [],
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "int1",
            access_token_encrypted: "enc",
            metadata: { notify_meeting_summaries: false },
          },
          error: null,
        }),
      );

    await notifyMeetingProcessed("m5");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("catches errors and does not throw", async () => {
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error("DB exploded")),
    });

    await expect(notifyMeetingProcessed("m-err")).resolves.toBeUndefined();
  });
});

// ─── notifyTaskCreated ───────────────────────────────────────────────

describe("notifyTaskCreated", () => {
  it("posts task creation message to correct channel", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "t1",
            title: "Write report",
            assignee: "Bob",
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: { id: "int1", access_token_encrypted: "enc", metadata: {} },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: { channel_id: "C_TASKS" },
          error: null,
        }),
      );

    await notifyTaskCreated("t1");

    expect(mockFormatTaskUpdate).toHaveBeenCalledWith(
      { title: "Write report", assignee: "Bob" },
      "created",
    );
    expect(mockPostMessage).toHaveBeenCalledWith(
      "decrypted:enc",
      "C_TASKS",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("silently returns when no crm_customer_id", async () => {
    mockAdminFrom.mockReturnValueOnce(
      buildQueryChain({
        data: {
          id: "t2",
          title: "Task",
          assignee: null,
          crm_customer_id: null,
        },
        error: null,
      }),
    );

    await notifyTaskCreated("t2");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("catches errors and does not throw", async () => {
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error("DB error")),
    });

    await expect(notifyTaskCreated("t-err")).resolves.toBeUndefined();
  });
});

// ─── notifyTaskCompleted ─────────────────────────────────────────────

describe("notifyTaskCompleted", () => {
  it("posts task completed message", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "t3",
            title: "Deploy fix",
            assignee: null,
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: { id: "int1", access_token_encrypted: "enc", metadata: {} },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: { channel_id: "C_DONE" },
          error: null,
        }),
      );

    await notifyTaskCompleted("t3");

    expect(mockFormatTaskUpdate).toHaveBeenCalledWith(
      { title: "Deploy fix", assignee: null },
      "completed",
    );
    expect(mockPostMessage).toHaveBeenCalled();
  });

  it("silently returns when notify_task_updates is false", async () => {
    mockAdminFrom
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "t4",
            title: "Task",
            assignee: null,
            crm_customer_id: "cust1",
          },
          error: null,
        }),
      )
      .mockReturnValueOnce(
        buildQueryChain({
          data: {
            id: "int1",
            access_token_encrypted: "enc",
            metadata: { notify_task_updates: false },
          },
          error: null,
        }),
      );

    await notifyTaskCompleted("t4");

    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it("catches errors and does not throw", async () => {
    mockAdminFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockRejectedValue(new Error("Network error")),
    });

    await expect(notifyTaskCompleted("t-err")).resolves.toBeUndefined();
  });
});

// ─── formatMeetingSummary (unit) ─────────────────────────────────────

describe("formatMeetingSummary (Block Kit structure)", () => {
  it("produces valid Block Kit with header, sections, and context", () => {
    const result = realFormatMeetingSummary({
      title: "Quarterly Review",
      date: "2026-04-01T10:00:00Z",
      participants: ["Alice", "Bob"],
      decisions: ["Go with Option A"],
      action_items: [{ title: "Send report", assignee: "Alice" }],
    });

    expect(result.text).toContain("Quarterly Review");
    const blockTypes = result.blocks.map((b) => (b as { type: string }).type);
    expect(blockTypes[0]).toBe("header");
    expect(blockTypes).toContain("section");
    expect(blockTypes).toContain("context");
  });

  it("shows None recorded when decisions and action_items are empty", () => {
    const result = realFormatMeetingSummary({
      title: "Quick Sync",
      date: "2026-04-01",
      participants: [],
      decisions: [],
      action_items: [],
    });

    const sectionBlocks = result.blocks.filter(
      (b) => (b as { type: string }).type === "section",
    );
    const allText = sectionBlocks
      .map((b) => (b as { text?: { text: string } }).text?.text ?? "")
      .join("\n");
    expect(allText).toContain("None recorded");
    expect(allText).toContain("None");
  });
});

// ─── formatTaskUpdate (unit) ─────────────────────────────────────────

describe("formatTaskUpdate (emoji and text)", () => {
  it("uses :clipboard: emoji for created", () => {
    const result = realFormatTaskUpdate({ title: "My Task" }, "created");
    const section = result.blocks.find(
      (b) => (b as { type: string }).type === "section",
    ) as { text: { text: string } };
    expect(section.text.text).toContain(":clipboard:");
    expect(result.text).toBe("Task created: My Task");
  });

  it("uses :pencil2: emoji for updated", () => {
    const result = realFormatTaskUpdate({ title: "My Task" }, "updated");
    const section = result.blocks.find(
      (b) => (b as { type: string }).type === "section",
    ) as { text: { text: string } };
    expect(section.text.text).toContain(":pencil2:");
  });

  it("uses :white_check_mark: emoji for completed", () => {
    const result = realFormatTaskUpdate({ title: "My Task" }, "completed");
    const section = result.blocks.find(
      (b) => (b as { type: string }).type === "section",
    ) as { text: { text: string } };
    expect(section.text.text).toContain(":white_check_mark:");
  });

  it("includes assignee when provided", () => {
    const result = realFormatTaskUpdate(
      { title: "Task", assignee: "Alice" },
      "created",
    );
    const section = result.blocks.find(
      (b) => (b as { type: string }).type === "section",
    ) as { text: { text: string } };
    expect(section.text.text).toContain("Alice");
  });

  it("omits assignee line when not provided", () => {
    const result = realFormatTaskUpdate({ title: "Task" }, "created");
    const section = result.blocks.find(
      (b) => (b as { type: string }).type === "section",
    ) as { text: { text: string } };
    expect(section.text.text).not.toContain("Assigned to:");
  });
});

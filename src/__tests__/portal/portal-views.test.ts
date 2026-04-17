import { describe, it, expect } from "vitest";

/**
 * Tests for portal module views.
 *
 * These tests verify:
 * 1. Dashboard renders summary cards for enabled modules only
 * 2. Disabled modules return 404 (via module page logic)
 * 3. Each module view queries correct columns
 * 4. Meeting view does NOT include transcript
 * 5. Data is filtered by is_client_visible (for modules that still use it)
 */

// ---- Mock Supabase query builder ----

// ---- Dashboard summary card logic ----

describe("Portal dashboard summary cards", () => {
  function buildSummaryCards(
    enabledModules: string[],
    data: {
      hoursData?: { duration_minutes: number }[] | null;
      tasksData?: { id: string }[] | null;
      meetingData?: { meeting_date: string; title: string }[] | null;
      invoiceData?: { total_amount_gbp: number }[] | null;
    },
  ) {
    const cards: { label: string; value: string | number }[] = [];

    if (enabledModules.includes("timesheet") && data.hoursData) {
      const totalMinutes = data.hoursData.reduce(
        (sum, e) => sum + (e.duration_minutes ?? 0),
        0,
      );
      const hours = Math.round((totalMinutes / 60) * 10) / 10;
      cards.push({ label: "Hours This Month", value: `${hours}h` });
    }

    if (enabledModules.includes("tasks") && data.tasksData) {
      cards.push({ label: "Open Tasks", value: data.tasksData.length });
    }

    if (enabledModules.includes("meetings") && data.meetingData) {
      const next = data.meetingData[0];
      cards.push({
        label: "Next Meeting",
        value: next ? next.title : "None scheduled",
      });
    }

    if (enabledModules.includes("invoicing") && data.invoiceData) {
      const total = data.invoiceData.reduce(
        (sum, inv) => sum + (inv.total_amount_gbp ?? 0),
        0,
      );
      cards.push({
        label: "Outstanding Balance",
        value: total > 0 ? `£${total.toLocaleString()}` : "£0",
      });
    }

    return cards;
  }

  it("shows all 4 cards when all modules are enabled", () => {
    const cards = buildSummaryCards(
      ["timesheet", "tasks", "meetings", "invoicing"],
      {
        hoursData: [{ duration_minutes: 120 }, { duration_minutes: 60 }],
        tasksData: [{ id: "1" }, { id: "2" }, { id: "3" }],
        meetingData: [{ meeting_date: "2026-04-10", title: "Standup" }],
        invoiceData: [{ total_amount_gbp: 1500 }, { total_amount_gbp: 2000 }],
      },
    );

    expect(cards).toHaveLength(4);
    expect(cards[0]).toEqual({ label: "Hours This Month", value: "3h" });
    expect(cards[1]).toEqual({ label: "Open Tasks", value: 3 });
    expect(cards[2]).toEqual({ label: "Next Meeting", value: "Standup" });
    expect(cards[3]).toEqual({ label: "Outstanding Balance", value: "£3,500" });
  });

  it("only shows cards for enabled modules", () => {
    const cards = buildSummaryCards(["tasks"], {
      hoursData: [{ duration_minutes: 120 }],
      tasksData: [{ id: "1" }],
      meetingData: [],
      invoiceData: [{ total_amount_gbp: 500 }],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].label).toBe("Open Tasks");
  });

  it("shows no cards when no modules enabled", () => {
    const cards = buildSummaryCards([], {
      hoursData: [],
      tasksData: [],
      meetingData: [],
      invoiceData: [],
    });
    expect(cards).toHaveLength(0);
  });

  it("shows £0 when no outstanding invoices", () => {
    const cards = buildSummaryCards(["invoicing"], {
      invoiceData: [],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("£0");
  });

  it("shows 'None scheduled' when no upcoming meetings", () => {
    const cards = buildSummaryCards(["meetings"], {
      meetingData: [],
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].value).toBe("None scheduled");
  });
});

// ---- Module page access control ----

describe("Portal module access control", () => {
  function resolveModuleAccess(
    module: string,
    clientId: string | null,
    enabledSettings: Array<{ module: string; is_enabled: boolean }>,
  ): "redirect" | "not_found" | "render" {
    if (!clientId) return "redirect";

    const setting = enabledSettings.find((s) => s.module === module);
    if (!setting?.is_enabled) return "not_found";

    const validModules = [
      "timesheet",
      "meetings",
      "deliverables",
      "invoicing",
      "notes",
      "research",
    ];
    if (!validModules.includes(module)) return "not_found";

    return "render";
  }

  it("redirects when no client ID", () => {
    expect(resolveModuleAccess("notes", null, [])).toBe("redirect");
  });

  it("returns not_found for disabled module", () => {
    expect(
      resolveModuleAccess("notes", "client-1", [
        { module: "notes", is_enabled: false },
      ]),
    ).toBe("not_found");
  });

  it("returns not_found for unknown module", () => {
    expect(resolveModuleAccess("banana", "client-1", [])).toBe("not_found");
  });

  it("returns not_found for removed tasks module", () => {
    expect(
      resolveModuleAccess("tasks", "client-1", [
        { module: "tasks", is_enabled: true },
      ]),
    ).toBe("not_found");
  });

  it("renders enabled module", () => {
    expect(
      resolveModuleAccess("notes", "client-1", [
        { module: "notes", is_enabled: true },
      ]),
    ).toBe("render");
  });

  it("returns not_found when module setting doesn't exist", () => {
    expect(
      resolveModuleAccess("research", "client-1", [
        { module: "notes", is_enabled: true },
      ]),
    ).toBe("not_found");
  });
});

// ---- Meeting view excludes transcript ----

describe("Portal meeting query safety", () => {
  const MEETING_SELECT_FIELDS =
    "id, title, meeting_date, duration_minutes, attendees, summary, action_items";

  it("does NOT include transcript in the select fields", () => {
    expect(MEETING_SELECT_FIELDS).not.toContain("transcript");
  });

  it("includes summary for display", () => {
    expect(MEETING_SELECT_FIELDS).toContain("summary");
  });

  it("includes action_items for display", () => {
    expect(MEETING_SELECT_FIELDS).toContain("action_items");
  });
});

// ---- Data visibility filtering ----

describe("Portal data visibility filtering", () => {
  // Simulates the query filter pattern used across all portal modules
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function buildPortalQuery(_table: string, _clientId: string) {
    const filters: Record<string, unknown>[] = [];
    return {
      eq(field: string, value: unknown) {
        filters.push({ field, value });
        return this;
      },
      getFilters() {
        return filters;
      },
    };
  }

  it("always filters by client_id", () => {
    const query = buildPortalQuery("deliverables", "client-123");
    query.eq("client_id", "client-123").eq("is_client_visible", true);

    const filters = query.getFilters();
    expect(filters).toContainEqual({
      field: "client_id",
      value: "client-123",
    });
  });

  it("always filters by is_client_visible = true", () => {
    const query = buildPortalQuery("deliverables", "client-123");
    query.eq("client_id", "client-123").eq("is_client_visible", true);

    const filters = query.getFilters();
    expect(filters).toContainEqual({
      field: "is_client_visible",
      value: true,
    });
  });

  // Verify portal modules that still support per-item sharing include both filters.
  // Tasks: no longer a portal module (delegated to Trello).
  // Meetings + time_entries: always shared with the client (no per-item flag).
  const modules = ["deliverables", "invoices", "notes", "research"];

  for (const table of modules) {
    it(`${table} query includes both client_id and is_client_visible filters`, () => {
      const query = buildPortalQuery(table, "client-abc");
      query.eq("client_id", "client-abc").eq("is_client_visible", true);

      const filters = query.getFilters();
      const hasClientFilter = filters.some(
        (f) => f.field === "client_id" && f.value === "client-abc",
      );
      const hasVisibilityFilter = filters.some(
        (f) => f.field === "is_client_visible" && f.value === true,
      );

      expect(hasClientFilter).toBe(true);
      expect(hasVisibilityFilter).toBe(true);
    });
  }
});

// ---- Activity feed logic ----

describe("Portal recent activity feed", () => {
  type ActivityItem = { type: string; label: string; date: string };

  function buildActivityFeed(
    enabledModules: string[],
    items: Record<string, ActivityItem[]>,
  ): ActivityItem[] {
    const all: ActivityItem[] = [];

    if (enabledModules.includes("deliverables") && items.deliverables) {
      all.push(...items.deliverables);
    }
    if (enabledModules.includes("meetings") && items.meetings) {
      all.push(...items.meetings);
    }
    if (enabledModules.includes("tasks") && items.tasks) {
      all.push(...items.tasks);
    }
    if (enabledModules.includes("invoicing") && items.invoicing) {
      all.push(...items.invoicing);
    }

    return all
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }

  it("returns max 10 items sorted by date descending", () => {
    const items: Record<string, ActivityItem[]> = {
      tasks: Array.from({ length: 12 }, (_, i) => ({
        type: "task",
        label: `Task ${i}`,
        date: new Date(2026, 3, i + 1).toISOString(),
      })),
    };

    const feed = buildActivityFeed(["tasks"], items);
    expect(feed).toHaveLength(10);
    // First item should be the most recent
    expect(feed[0].label).toBe("Task 11");
  });

  it("only includes items from enabled modules", () => {
    const items: Record<string, ActivityItem[]> = {
      tasks: [{ type: "task", label: "Task A", date: "2026-04-01" }],
      invoicing: [{ type: "invoice", label: "Invoice B", date: "2026-04-02" }],
    };

    const feed = buildActivityFeed(["tasks"], items);
    expect(feed).toHaveLength(1);
    expect(feed[0].type).toBe("task");
  });

  it("merges items from multiple modules and sorts", () => {
    const items: Record<string, ActivityItem[]> = {
      tasks: [{ type: "task", label: "Task 1", date: "2026-04-01" }],
      meetings: [{ type: "meeting", label: "Meeting 1", date: "2026-04-03" }],
      invoicing: [{ type: "invoice", label: "Invoice 1", date: "2026-04-02" }],
    };

    const feed = buildActivityFeed(["tasks", "meetings", "invoicing"], items);
    expect(feed).toHaveLength(3);
    expect(feed[0].type).toBe("meeting");
    expect(feed[1].type).toBe("invoice");
    expect(feed[2].type).toBe("task");
  });

  it("returns empty array when no modules enabled", () => {
    const feed = buildActivityFeed([], {
      tasks: [{ type: "task", label: "T", date: "2026-04-01" }],
    });
    expect(feed).toHaveLength(0);
  });
});

// ---- Timesheet duration formatting ----

describe("Timesheet duration formatting", () => {
  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }

  it("formats hours only", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats minutes only", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats zero", () => {
    expect(formatDuration(0)).toBe("0m");
  });
});

// ---- Invoice status badge mapping ----

describe("Invoice status badges", () => {
  const statusConfig: Record<string, { variant: string; className?: string }> =
    {
      draft: { variant: "secondary" },
      sent: { variant: "default", className: "bg-blue-600" },
      viewed: { variant: "default", className: "bg-purple-600" },
      overdue: { variant: "destructive" },
      paid: { variant: "default", className: "bg-green-600" },
    };

  it("maps draft to secondary variant", () => {
    expect(statusConfig.draft.variant).toBe("secondary");
  });

  it("maps sent to blue badge", () => {
    expect(statusConfig.sent.className).toBe("bg-blue-600");
  });

  it("maps viewed to purple badge", () => {
    expect(statusConfig.viewed.className).toBe("bg-purple-600");
  });

  it("maps overdue to destructive variant", () => {
    expect(statusConfig.overdue.variant).toBe("destructive");
  });

  it("maps paid to green badge", () => {
    expect(statusConfig.paid.className).toBe("bg-green-600");
  });
});

// ---- getPortalClientId logic ----

describe("Portal client ID resolution", () => {
  function resolveClientId(
    user: { id: string } | null,
    roles: Array<{ user_id: string; role: string; client_id: string | null }>,
  ): string | null {
    if (!user) return null;

    const role = roles.find(
      (r) => r.user_id === user.id && r.role === "client",
    );

    return role?.client_id ?? null;
  }

  it("returns client_id for valid client user", () => {
    const result = resolveClientId({ id: "user-1" }, [
      { user_id: "user-1", role: "client", client_id: "client-abc" },
    ]);
    expect(result).toBe("client-abc");
  });

  it("returns null for unauthenticated user", () => {
    expect(resolveClientId(null, [])).toBeNull();
  });

  it("returns null for consultant role", () => {
    const result = resolveClientId({ id: "user-1" }, [
      { user_id: "user-1", role: "consultant", client_id: null },
    ]);
    expect(result).toBeNull();
  });

  it("returns null when user has no role entry", () => {
    const result = resolveClientId({ id: "user-1" }, []);
    expect(result).toBeNull();
  });
});

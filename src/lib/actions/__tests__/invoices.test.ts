import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  formatDays,
  calculateMonthBreakdown,
  buildInvoiceText,
  suggestNextInvoiceNumber,
} from "../invoices";

// --- Pure function tests (no mocks needed) ---

describe("formatDays", () => {
  it("returns singular for exactly 1", async () => {
    expect(await formatDays(1)).toBe("1 day");
  });

  it("returns plural for values other than 1", async () => {
    expect(await formatDays(2)).toBe("2 days");
    expect(await formatDays(0.5)).toBe("0.5 days");
    expect(await formatDays(0)).toBe("0 days");
  });

  it("trims trailing zeros", async () => {
    expect(await formatDays(2.5)).toBe("2.5 days");
    expect(await formatDays(2.25)).toBe("2.25 days");
    expect(await formatDays(3.1)).toBe("3.1 days");
  });

  it("rounds to 3 decimal places", async () => {
    expect(await formatDays(2.87500001)).toBe("2.875 days");
    expect(await formatDays(1.33333333)).toBe("1.333 days");
  });
});

describe("calculateMonthBreakdown", () => {
  const hoursPerDay = 3.2; // 16 hours_per_week / 5

  it("groups entries by month", async () => {
    const entries = [
      { started_at: "2026-01-15T09:00:00Z", duration_minutes: 192 }, // 1 day
      { started_at: "2026-01-20T09:00:00Z", duration_minutes: 96 }, // 0.5 day
      { started_at: "2026-02-10T09:00:00Z", duration_minutes: 384 }, // 2 days
    ];

    const result = await calculateMonthBreakdown(entries, hoursPerDay);

    expect(result).toHaveLength(2);
    expect(result[0].month).toBe("Jan 26");
    expect(result[0].totalMinutes).toBe(288);
    expect(result[0].totalDays).toBe(288 / 60 / hoursPerDay);
    expect(result[0].label).toBe("Jan 26 - 1.5 days");

    expect(result[1].month).toBe("Feb 26");
    expect(result[1].totalMinutes).toBe(384);
    expect(result[1].label).toBe("Feb 26 - 2 days");
  });

  it("returns empty array for no entries", async () => {
    expect(await calculateMonthBreakdown([], hoursPerDay)).toEqual([]);
  });

  it("skips entries with null duration", async () => {
    const entries = [
      { started_at: "2026-01-15T09:00:00Z", duration_minutes: 192 },
      { started_at: "2026-01-20T09:00:00Z", duration_minutes: null },
    ];

    const result = await calculateMonthBreakdown(entries, hoursPerDay);
    expect(result).toHaveLength(1);
    expect(result[0].totalMinutes).toBe(192);
  });

  it("sorts months chronologically", async () => {
    const entries = [
      { started_at: "2026-03-05T09:00:00Z", duration_minutes: 192 },
      { started_at: "2026-01-10T09:00:00Z", duration_minutes: 192 },
      { started_at: "2026-02-15T09:00:00Z", duration_minutes: 192 },
    ];

    const result = await calculateMonthBreakdown(entries, hoursPerDay);
    expect(result.map((r) => r.month)).toEqual(["Jan 26", "Feb 26", "Mar 26"]);
  });

  it("uses singular 'day' for exactly 1 day", async () => {
    const entries = [
      {
        started_at: "2026-01-15T09:00:00Z",
        duration_minutes: hoursPerDay * 60,
      },
    ];
    const result = await calculateMonthBreakdown(entries, hoursPerDay);
    expect(result[0].label).toBe("Jan 26 - 1 day");
  });
});

describe("buildInvoiceText", () => {
  it("builds correctly formatted text", async () => {
    const breakdown = [
      {
        month: "Jan 26",
        totalMinutes: 480,
        totalDays: 1,
        label: "Jan 26 - 1 day",
      },
      {
        month: "Feb 26",
        totalMinutes: 1080,
        totalDays: 2.25,
        label: "Feb 26 - 2.25 days",
      },
      {
        month: "Mar 26",
        totalMinutes: 1380,
        totalDays: 2.875,
        label: "Mar 26 - 2.875 days",
      },
    ];
    const totalDays = 6.125;
    const dayRate = 500;
    const totalAmount = 3062.5;

    const text = await buildInvoiceText(
      breakdown,
      totalDays,
      dayRate,
      totalAmount,
    );

    expect(text).toContain("6.125 Days");
    expect(text).toContain("Jan 26 - 1 day");
    expect(text).toContain("Feb 26 - 2.25 days");
    expect(text).toContain("Mar 26 - 2.875 days");
    expect(text).toContain("Total for Jan 26 to Mar 26 = 6.125");
    expect(text).toContain("Timesheets available on request");
    expect(text).toContain("Unit Price (£): 500.00");
    expect(text).toContain("Subtotal (£): 3,062.50");
  });

  it("handles single month range", async () => {
    const breakdown = [
      {
        month: "Jan 26",
        totalMinutes: 480,
        totalDays: 1,
        label: "Jan 26 - 1 day",
      },
    ];
    const text = await buildInvoiceText(breakdown, 1, 500, 500);
    expect(text).toContain("Total for Jan 26 = 1");
  });
});

describe("suggestNextInvoiceNumber", () => {
  it("returns INV-001 for null", async () => {
    expect(await suggestNextInvoiceNumber(null)).toBe("INV-001");
  });

  it("increments numeric suffix", async () => {
    expect(await suggestNextInvoiceNumber("INV-001")).toBe("INV-002");
    expect(await suggestNextInvoiceNumber("INV-009")).toBe("INV-010");
    expect(await suggestNextInvoiceNumber("INV-099")).toBe("INV-100");
  });

  it("preserves padding", async () => {
    expect(await suggestNextInvoiceNumber("INV-003")).toBe("INV-004");
  });

  it("handles different prefixes", async () => {
    expect(await suggestNextInvoiceNumber("ACME-005")).toBe("ACME-006");
  });

  it("returns INV-001 for non-numeric suffix", async () => {
    expect(await suggestNextInvoiceNumber("random-text")).toBe("INV-001");
  });
});

// --- Server action tests (with mocks) ---

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const mockSingle = vi.fn();
const mockLimit = vi.fn(() => ({ single: mockSingle }));
const mockLte = vi.fn().mockReturnThis();
const mockGte = vi.fn(() => ({ lte: mockLte }));
const mockOrder = vi.fn(() => ({ limit: mockLimit }));
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, single: mockSingle }));
const mockDelete = vi.fn(() => ({ eq: mockEq }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));

const mockFrom = vi.fn((table: string) => {
  if (table === "time_entries") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(() => ({
              lte: vi.fn(() => ({
                data: [
                  { started_at: "2026-01-15T09:00:00Z", duration_minutes: 480 },
                  { started_at: "2026-02-10T09:00:00Z", duration_minutes: 240 },
                ],
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
  }
  if (table === "engagements") {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { day_rate_gbp: 500, hours_per_week: 40 },
                error: null,
              })),
            })),
          })),
        })),
      })),
    };
  }
  if (table === "invoices") {
    return {
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { invoice_number: "INV-003" },
                error: null,
              })),
            })),
          })),
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
    };
  }
  return {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("createInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockReturnValue({ data: { id: "inv-new" }, error: null });
    mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
    mockEq.mockReturnValue({ error: null });
  });

  it("returns error for invalid data", async () => {
    const { createInvoice } = await import("../invoices");
    const result = await createInvoice({
      invoice_number: "",
      period_start: "2026-01-01",
      period_end: "2026-03-31",
      status: "draft",
    });
    expect(result).toEqual({ error: "Invalid form data" });
  });

  it("calls supabase insert for valid data", async () => {
    mockInsert.mockReturnValue({
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          data: { id: "inv-new" },
          error: null,
        })),
      })),
    });

    const { createInvoice } = await import("../invoices");
    const result = await createInvoice({
      invoice_number: "INV-001",
      period_start: "2026-01-01",
      period_end: "2026-03-31",
      status: "draft",
    });

    expect(mockFrom).toHaveBeenCalledWith("time_entries");
    expect(mockFrom).toHaveBeenCalledWith("engagements");
    expect(mockFrom).toHaveBeenCalledWith("invoices");
  });
});

describe("markAsPaid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ error: null });
  });

  it("updates status and paid_on", async () => {
    mockUpdate.mockReturnValue({ eq: mockEq });
    const { markAsPaid } = await import("../invoices");
    const result = await markAsPaid("inv-1", "2026-03-27");

    expect(mockFrom).toHaveBeenCalledWith("invoices");
    expect(mockUpdate).toHaveBeenCalledWith({
      status: "paid",
      paid_on: "2026-03-27",
    });
  });
});

describe("deleteInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEq.mockReturnValue({ error: null });
  });

  it("deletes the invoice", async () => {
    mockDelete.mockReturnValue({ eq: mockEq });
    const { deleteInvoice } = await import("../invoices");
    const result = await deleteInvoice("inv-1");

    expect(mockFrom).toHaveBeenCalledWith("invoices");
    expect(mockDelete).toHaveBeenCalled();
    expect(mockEq).toHaveBeenCalledWith("id", "inv-1");
  });
});

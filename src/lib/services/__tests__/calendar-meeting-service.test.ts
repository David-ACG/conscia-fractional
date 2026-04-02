import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Supabase admin mock
// ──────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ──────────────────────────────────────────────────────────
// Chain helper
// ──────────────────────────────────────────────────────────
/**
 * Build a Supabase-like chainable query mock.
 * All methods return `this` for chaining, and the chain itself is then-able
 * (has a `then` method that resolves to { data, error }).
 */
function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> &
    PromiseLike<{ data: unknown; error: unknown }> = Object.create(null);

  // Make the chain itself await-able (thenable)
  chain.then = (
    onfulfilled: (value: { data: unknown; error: unknown }) => unknown,
  ) => {
    return Promise.resolve({ data, error }).then(onfulfilled);
  };

  const methods = [
    "select",
    "eq",
    "in",
    "not",
    "order",
    "limit",
    "single",
    "update",
    "insert",
    "upsert",
  ];
  for (const m of methods) {
    (chain as Record<string, unknown>)[m] = vi.fn(() => chain);
  }
  // .single() should resolve immediately too
  (chain.single as ReturnType<typeof vi.fn>).mockReturnValue(
    Promise.resolve({ data, error }),
  );

  return chain;
}

import {
  linkMeetingToEvent,
  getEventForPreFill,
} from "../calendar-meeting-service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Tests: linkMeetingToEvent
// ──────────────────────────────────────────────────────────
describe("linkMeetingToEvent", () => {
  it("updates calendar_events.meeting_id", async () => {
    const updateChain = makeChain(null);
    mockFrom.mockReturnValue(updateChain);

    await linkMeetingToEvent("meeting-123", "event-456");

    expect(mockFrom).toHaveBeenCalledWith("calendar_events");
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ meeting_id: "meeting-123" }),
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "event-456");
  });

  it("is a no-op when admin client is unavailable", async () => {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    vi.mocked(createAdminClient).mockReturnValueOnce(
      null as unknown as ReturnType<typeof createAdminClient>,
    );

    await expect(linkMeetingToEvent("m1", "e1")).resolves.toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: getEventForPreFill
// ──────────────────────────────────────────────────────────
describe("getEventForPreFill", () => {
  it("returns null when event is not found", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      return makeChain(null);
    });

    const result = await getEventForPreFill("no-event");
    expect(result).toBeNull();
  });

  it("returns correct pre-fill data with duration rounded up to 15 minutes", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events
        return makeChain({
          id: "evt-1",
          title: "Architecture Review",
          start_time: "2026-04-01T09:00:00Z",
          end_time: "2026-04-01T10:10:00Z", // 70 minutes → rounds up to 75
          attendees: [
            { email: "alice@acme.com", name: "Alice" },
            { email: "bob@beta.com", name: null },
          ],
          crm_customer_id: "cust-acme",
          meeting_url: "https://meet.google.com/abc-def",
        });
      }
      if (callCount === 2) {
        // contacts query
        return makeChain([{ id: "contact-1", email: "alice@acme.com" }]);
      }
      return makeChain(null);
    });

    const result = await getEventForPreFill("evt-1");

    expect(result).not.toBeNull();
    expect(result!.title).toBe("Architecture Review");
    expect(result!.date).toBe("2026-04-01T09:00:00Z");
    expect(result!.duration).toBe(75); // 70 min rounded up to 75
    expect(result!.crm_customer_id).toBe("cust-acme");
    expect(result!.meeting_url).toBe("https://meet.google.com/abc-def");
    expect(result!.source_event_id).toBe("evt-1");
  });

  it("maps matched attendees with contact_id and unmatched ones without", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-2",
          title: "Client Call",
          start_time: "2026-04-01T14:00:00Z",
          end_time: "2026-04-01T15:00:00Z", // 60 minutes
          attendees: [
            { email: "known@acme.com", name: "Known Person" },
            { email: "unknown@nobody.com", name: "Unknown Person" },
          ],
          crm_customer_id: null,
          meeting_url: null,
        });
      }
      if (callCount === 2) {
        // Only known@acme.com is in contacts
        return makeChain([{ id: "contact-99", email: "known@acme.com" }]);
      }
      return makeChain(null);
    });

    const result = await getEventForPreFill("evt-2");

    expect(result!.participants).toHaveLength(2);

    const known = result!.participants.find(
      (p) => p.email === "known@acme.com",
    );
    expect(known?.contact_id).toBe("contact-99");
    expect(known?.name).toBe("Known Person");

    const unknown = result!.participants.find(
      (p) => p.email === "unknown@nobody.com",
    );
    expect(unknown?.contact_id).toBeUndefined();
    expect(unknown?.name).toBe("Unknown Person");
  });

  it("rounds duration correctly: exact 15 min stays at 15", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-3",
          title: "Quick Sync",
          start_time: "2026-04-01T09:00:00Z",
          end_time: "2026-04-01T09:15:00Z", // exactly 15 minutes
          attendees: [],
          crm_customer_id: null,
          meeting_url: null,
        });
      }
      // contacts — no emails to query
      return makeChain([]);
    });

    const result = await getEventForPreFill("evt-3");
    expect(result!.duration).toBe(15);
  });

  it("rounds duration: 61 minutes → 75", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-4",
          title: "Long Meeting",
          start_time: "2026-04-01T10:00:00Z",
          end_time: "2026-04-01T11:01:00Z", // 61 minutes → rounds to 75
          attendees: [],
          crm_customer_id: null,
          meeting_url: null,
        });
      }
      return makeChain([]);
    });

    const result = await getEventForPreFill("evt-4");
    expect(result!.duration).toBe(75);
  });

  it("uses attendee email as name when name is null", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-5",
          title: "Meeting",
          start_time: "2026-04-01T09:00:00Z",
          end_time: "2026-04-01T09:30:00Z",
          attendees: [{ email: "noname@example.com", name: null }],
          crm_customer_id: null,
          meeting_url: null,
        });
      }
      return makeChain([]);
    });

    const result = await getEventForPreFill("evt-5");
    expect(result!.participants[0].name).toBe("noname@example.com");
  });
});

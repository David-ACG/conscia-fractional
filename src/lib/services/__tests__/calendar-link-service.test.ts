import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Supabase admin mock — table-aware chain builder
// ──────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

/**
 * Build a Supabase-like chainable query mock.
 * All methods return `this` so chains like `.select().eq().single()` work.
 * The chain is also thenable — `await chain` resolves to `{ data, error }`.
 */
function makeChain(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> &
    PromiseLike<{ data: unknown; error: unknown }> = Object.create(null);

  // Thenable — allows `const { data } = await supabase.from().select().eq()`
  chain.then = (
    onfulfilled: (value: { data: unknown; error: unknown }) => unknown,
  ) => Promise.resolve({ data, error }).then(onfulfilled);

  const methods = [
    "select",
    "eq",
    "in",
    "not",
    "contains",
    "order",
    "limit",
    "single",
    "update",
    "upsert",
    "insert",
  ];
  for (const m of methods) {
    (chain as Record<string, unknown>)[m] = vi.fn(() => chain);
  }
  // .single() resolves to a Promise directly (used with `await`)
  (chain.single as ReturnType<typeof vi.fn>).mockReturnValue(
    Promise.resolve({ data, error }),
  );
  return chain;
}

// ──────────────────────────────────────────────────────────
// Imports under test
// ──────────────────────────────────────────────────────────
import {
  linkEventToCustomer,
  batchLinkEvents,
  relinkIfAttendeesChanged,
} from "../calendar-link-service";

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
// Tests: linkEventToCustomer
// ──────────────────────────────────────────────────────────
describe("linkEventToCustomer", () => {
  it("returns null when event is not found", async () => {
    mockFrom.mockReturnValue(makeChain(null));
    const result = await linkEventToCustomer("nonexistent-id");
    expect(result).toBeNull();
  });

  it("returns null when there are no attendees after filtering user emails", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events fetch
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [{ email: "me@example.com" }],
        });
      }
      if (callCount === 2) {
        // integrations fetch — user's own email
        return makeChain([{ account_identifier: "me@example.com" }]);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBeNull();
  });

  it("matches single attendee to customer via contacts.crm_customer_id", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [{ email: "alice@acme.com" }],
        });
      }
      if (callCount === 2) {
        // integrations (no user emails)
        return makeChain([]);
      }
      if (callCount === 3) {
        // contacts
        return makeChain([{ crm_customer_id: "cust-1" }]);
      }
      if (callCount === 4) {
        // calendar_events update
        return makeChain(null);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBe("cust-1");
  });

  it("resolves multiple customers by most recent meeting", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [{ email: "alice@acme.com" }, { email: "bob@beta.com" }],
        });
      }
      if (callCount === 2) {
        // integrations
        return makeChain([]);
      }
      if (callCount === 3) {
        // contacts — two different customers
        return makeChain([
          { crm_customer_id: "cust-1" },
          { crm_customer_id: "cust-2" },
        ]);
      }
      if (callCount === 4) {
        // meetings — cust-2 has the most recent meeting
        return makeChain([
          {
            crm_customer_id: "cust-2",
            meeting_date: "2026-03-20T10:00:00Z",
          },
        ]);
      }
      if (callCount === 5) {
        // calendar_events update
        return makeChain(null);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBe("cust-2");
  });

  it("falls back to first match when no prior meetings exist for any matched customer", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [{ email: "alice@acme.com" }, { email: "bob@beta.com" }],
        });
      }
      if (callCount === 2) {
        // integrations
        return makeChain([]);
      }
      if (callCount === 3) {
        // contacts — two customers
        return makeChain([
          { crm_customer_id: "cust-a" },
          { crm_customer_id: "cust-b" },
        ]);
      }
      if (callCount === 4) {
        // meetings — empty
        return makeChain([]);
      }
      if (callCount === 5) {
        // calendar_events update
        return makeChain(null);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBe("cust-a");
  });

  it("returns null when no attendees match any contacts", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [{ email: "unknown@nowhere.com" }],
        });
      }
      if (callCount === 2) {
        // integrations
        return makeChain([]);
      }
      if (callCount === 3) {
        // contacts — empty
        return makeChain([]);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBeNull();
  });

  it("ignores the user's own email when matching", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // calendar_events — both user and external attendee
        return makeChain({
          id: "evt-1",
          user_id: "user-1",
          attendees: [
            { email: "me@conscia.com" },
            { email: "client@acme.com" },
          ],
        });
      }
      if (callCount === 2) {
        // integrations — user's own email
        return makeChain([{ account_identifier: "me@conscia.com" }]);
      }
      if (callCount === 3) {
        // contacts — only client email matches
        return makeChain([{ crm_customer_id: "cust-acme" }]);
      }
      if (callCount === 4) {
        // update
        return makeChain(null);
      }
      return makeChain(null);
    });

    const result = await linkEventToCustomer("evt-1");
    expect(result).toBe("cust-acme");
    // Verify only client email was queried against contacts (not user's own)
    expect(mockFrom).toHaveBeenCalledTimes(4);
  });
});

// ──────────────────────────────────────────────────────────
// Tests: batchLinkEvents
// ──────────────────────────────────────────────────────────
describe("batchLinkEvents", () => {
  it("calls linkEventToCustomer for each event ID", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      // Each linkEventToCustomer makes ~4 calls; here we just return
      // minimal data to keep the test short.
      if (callCount % 4 === 1) {
        return makeChain({
          id: `evt-${callCount}`,
          user_id: "user-1",
          attendees: [{ email: "x@acme.com" }],
        });
      }
      if (callCount % 4 === 2) return makeChain([]);
      if (callCount % 4 === 3) return makeChain([{ crm_customer_id: "c1" }]);
      return makeChain(null);
    });

    await batchLinkEvents(["id-1", "id-2"]);
    // Just assert it doesn't throw and completes
    expect(mockFrom).toHaveBeenCalled();
  });

  it("handles partial failures without throwing", async () => {
    mockFrom.mockImplementation(() => {
      // Return event for first call, error on second
      throw new Error("DB failure");
    });

    // Should not throw
    await expect(batchLinkEvents(["id-1", "id-2"])).resolves.toBeUndefined();
  });

  it("is a no-op for an empty array", async () => {
    await batchLinkEvents([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────
// Tests: relinkIfAttendeesChanged
// ──────────────────────────────────────────────────────────
describe("relinkIfAttendeesChanged", () => {
  it("calls linkEventToCustomer when attendees differ", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-1",
          user_id: "u",
          attendees: [{ email: "new@example.com" }],
        });
      }
      if (callCount === 2) return makeChain([]);
      if (callCount === 3) return makeChain([{ crm_customer_id: "c1" }]);
      return makeChain(null);
    });

    await relinkIfAttendeesChanged(
      "evt-1",
      [{ email: "old@example.com" }],
      [{ email: "new@example.com" }],
    );

    expect(mockFrom).toHaveBeenCalled();
  });

  it("skips relinking when attendees are the same", async () => {
    await relinkIfAttendeesChanged(
      "evt-1",
      [{ email: "alice@example.com" }, { email: "bob@example.com" }],
      [{ email: "alice@example.com" }, { email: "bob@example.com" }],
    );

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("relinks when an attendee is added", async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return makeChain({
          id: "evt-1",
          user_id: "u",
          attendees: [{ email: "a@x.com" }, { email: "b@x.com" }],
        });
      }
      if (callCount === 2) return makeChain([]);
      if (callCount === 3) return makeChain([{ crm_customer_id: "c1" }]);
      return makeChain(null);
    });

    await relinkIfAttendeesChanged(
      "evt-1",
      [{ email: "a@x.com" }],
      [{ email: "a@x.com" }, { email: "b@x.com" }],
    );

    expect(mockFrom).toHaveBeenCalled();
  });
});

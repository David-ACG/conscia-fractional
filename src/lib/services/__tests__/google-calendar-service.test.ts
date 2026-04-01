import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// googleapis — mock calendar.events.list
// ──────────────────────────────────────────────────────────
const mockEventsList = vi.fn();

vi.mock("googleapis", () => {
  function MockOAuth2() {}
  return {
    google: {
      auth: { OAuth2: MockOAuth2 },
      calendar: vi.fn(() => ({
        events: { list: mockEventsList },
      })),
    },
  };
});

// ──────────────────────────────────────────────────────────
// Supabase admin — table-aware chain mocks
// ──────────────────────────────────────────────────────────
const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────
// The real OAuth2Client doesn't matter in tests — google.calendar is fully mocked.
function makeOAuth2Client(): Parameters<
  typeof import("../google-calendar-service").syncEvents
>[0] {
  return {} as Parameters<
    typeof import("../google-calendar-service").syncEvents
  >[0];
}

function makeGoogleEvent(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "event-id-1",
    summary: "Team Standup",
    description: null,
    start: { dateTime: "2026-04-01T09:00:00Z" },
    end: { dateTime: "2026-04-01T09:30:00Z" },
    status: "confirmed",
    attendees: [
      {
        email: "alice@example.com",
        displayName: "Alice",
        responseStatus: "accepted",
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ──────────────────────────────────────────────────────────
describe("extractMeetingUrl", () => {
  it("returns hangoutLink when present", async () => {
    const { extractMeetingUrl } = await import("../google-calendar-service");
    const event = {
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      description: null,
      location: null,
    };
    expect(extractMeetingUrl(event)).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
  });

  it("finds Zoom URL in description", async () => {
    const { extractMeetingUrl } = await import("../google-calendar-service");
    const event = {
      hangoutLink: null,
      description: "Join meeting: https://us02web.zoom.us/j/1234567890?pwd=abc",
      location: null,
    };
    expect(extractMeetingUrl(event)).toContain("zoom.us/j/");
  });

  it("finds Teams URL in location", async () => {
    const { extractMeetingUrl } = await import("../google-calendar-service");
    const event = {
      hangoutLink: null,
      description: null,
      location:
        "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0?context={}",
    };
    expect(extractMeetingUrl(event)).toContain("teams.microsoft.com");
  });

  it("returns null when no meeting URL found", async () => {
    const { extractMeetingUrl } = await import("../google-calendar-service");
    const event = {
      hangoutLink: null,
      description: "Regular meeting",
      location: "Conference Room A",
    };
    expect(extractMeetingUrl(event)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────
describe("syncEvents", () => {
  it("does full sync with correct time range when no syncToken", async () => {
    mockEventsList.mockResolvedValue({
      data: {
        items: [makeGoogleEvent()],
        nextSyncToken: "sync-token-abc",
      },
    });

    const { syncEvents } = await import("../google-calendar-service");
    const auth = makeOAuth2Client();
    const result = await syncEvents(auth);

    expect(mockEventsList).toHaveBeenCalledOnce();
    const callArgs = mockEventsList.mock.calls[0][0];
    expect(callArgs).toMatchObject({
      calendarId: "primary",
      singleEvents: true,
    });
    expect(callArgs).toHaveProperty("timeMin");
    expect(callArgs).toHaveProperty("timeMax");
    expect(callArgs).not.toHaveProperty("syncToken");

    expect(result.events).toHaveLength(1);
    expect(result.events[0].google_event_id).toBe("event-id-1");
    expect(result.nextSyncToken).toBe("sync-token-abc");
  });

  it("does incremental sync when syncToken provided", async () => {
    mockEventsList.mockResolvedValue({
      data: {
        items: [makeGoogleEvent({ id: "event-id-2", summary: "New Event" })],
        nextSyncToken: "sync-token-new",
      },
    });

    const { syncEvents } = await import("../google-calendar-service");
    const auth = makeOAuth2Client();
    const result = await syncEvents(auth, "existing-sync-token");

    const callArgs = mockEventsList.mock.calls[0][0];
    expect(callArgs.syncToken).toBe("existing-sync-token");
    expect(callArgs).not.toHaveProperty("timeMin");
    expect(result.events[0].google_event_id).toBe("event-id-2");
    expect(result.nextSyncToken).toBe("sync-token-new");
  });

  it("handles 410 Gone by clearing syncToken and doing full re-sync", async () => {
    const goneError = Object.assign(new Error("Gone"), {
      response: { status: 410 },
    });

    mockEventsList.mockRejectedValueOnce(goneError).mockResolvedValueOnce({
      data: {
        items: [makeGoogleEvent()],
        nextSyncToken: "fresh-sync-token",
      },
    });

    const { syncEvents } = await import("../google-calendar-service");
    const auth = makeOAuth2Client();
    const result = await syncEvents(auth, "stale-sync-token");

    expect(mockEventsList).toHaveBeenCalledTimes(2);
    // Second call should be a full sync (no syncToken, has timeMin/timeMax)
    const secondCallArgs = mockEventsList.mock.calls[1][0];
    expect(secondCallArgs).not.toHaveProperty("syncToken");
    expect(secondCallArgs).toHaveProperty("timeMin");
    expect(result.nextSyncToken).toBe("fresh-sync-token");
  });

  it("handles pagination across multiple pages", async () => {
    mockEventsList
      .mockResolvedValueOnce({
        data: {
          items: [makeGoogleEvent({ id: "ev-1" })],
          nextPageToken: "page-2-token",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [makeGoogleEvent({ id: "ev-2" })],
          nextPageToken: "page-3-token",
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [makeGoogleEvent({ id: "ev-3" })],
          nextSyncToken: "final-sync-token",
        },
      });

    const { syncEvents } = await import("../google-calendar-service");
    const auth = makeOAuth2Client();
    const result = await syncEvents(auth);

    expect(mockEventsList).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(3);
    expect(result.events.map((e) => e.google_event_id)).toEqual([
      "ev-1",
      "ev-2",
      "ev-3",
    ]);
    expect(result.nextSyncToken).toBe("final-sync-token");
  });
});

// ──────────────────────────────────────────────────────────
describe("matchAttendeesToCustomer", () => {
  // Creates a proxy where every method call returns a new proxy of the same kind,
  // and awaiting it resolves to { data, error: null }.
  function tableProxy(data: unknown[]) {
    function makeProxy(): object {
      return new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") {
              return (resolve: (v: { data: unknown[]; error: null }) => void) =>
                Promise.resolve({ data, error: null }).then(resolve);
            }
            return () => makeProxy();
          },
        },
      );
    }
    return makeProxy();
  }

  function setupMockFrom(
    opts: {
      integrations?: unknown[];
      contacts?: unknown[];
      meetings?: unknown[];
      customers?: unknown[];
    } = {},
  ) {
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") return tableProxy(opts.integrations ?? []);
      if (table === "contacts") return tableProxy(opts.contacts ?? []);
      if (table === "meetings") return tableProxy(opts.meetings ?? []);
      if (table === "crm_customers") return tableProxy(opts.customers ?? []);
      return tableProxy([]);
    });
  }

  it("matches attendee email to contact's CRM customer via most recent meeting", async () => {
    setupMockFrom({
      integrations: [{ account_identifier: "me@gmail.com" }],
      contacts: [{ client_id: "client-1" }],
      meetings: [{ crm_customer_id: "customer-1" }],
    });

    const { matchAttendeesToCustomer } =
      await import("../google-calendar-service");
    const result = await matchAttendeesToCustomer(
      [{ email: "alice@example.com" }],
      "user-1",
    );

    expect(result).toBe("customer-1");
  });

  it("returns most recent meeting customer when multiple clients match", async () => {
    setupMockFrom({
      integrations: [],
      contacts: [{ client_id: "client-1" }, { client_id: "client-2" }],
      meetings: [
        { crm_customer_id: "customer-most-recent" },
        { crm_customer_id: "customer-older" },
      ],
    });

    const { matchAttendeesToCustomer } =
      await import("../google-calendar-service");
    const result = await matchAttendeesToCustomer(
      [{ email: "bob@example.com" }, { email: "carol@example.com" }],
      "user-1",
    );

    expect(result).toBe("customer-most-recent");
  });

  it("returns null when no contacts match attendee emails", async () => {
    setupMockFrom({
      integrations: [],
      contacts: [],
    });

    const { matchAttendeesToCustomer } =
      await import("../google-calendar-service");
    const result = await matchAttendeesToCustomer(
      [{ email: "unknown@nowhere.com" }],
      "user-1",
    );

    expect(result).toBeNull();
  });

  it("excludes the user's own email from matching", async () => {
    setupMockFrom({
      integrations: [{ account_identifier: "david@gmail.com" }],
      contacts: [],
    });

    const { matchAttendeesToCustomer } =
      await import("../google-calendar-service");
    // Only attendee is the user themselves
    const result = await matchAttendeesToCustomer(
      [{ email: "david@gmail.com" }],
      "user-1",
    );

    expect(result).toBeNull();
  });
});

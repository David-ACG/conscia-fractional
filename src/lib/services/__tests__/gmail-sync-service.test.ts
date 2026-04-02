import { describe, it, expect, vi, beforeEach } from "vitest";

// ──────────────────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────────────────

const mockGetValidAccessToken = vi.fn();
vi.mock("@/lib/services/google-auth-service", () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}));

const mockGetGmailClient = vi.fn();
const mockListMessages = vi.fn();
vi.mock("@/lib/services/gmail-service", () => ({
  getGmailClient: (...args: unknown[]) => mockGetGmailClient(...args),
  listMessages: (...args: unknown[]) => mockListMessages(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

const INTEGRATION_ID = "int-1";
const USER_ID = "user-1";

function makeIntegration(metaOverrides: Record<string, unknown> = {}) {
  return {
    id: INTEGRATION_ID,
    user_id: USER_ID,
    provider: "google",
    scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    metadata: metaOverrides,
    is_active: true,
  };
}

function makeCustomer(id: string, name: string) {
  return { id, name };
}

function makeContact(id: string, email: string, crm_customer_id: string) {
  return { id, email, crm_customer_id };
}

function makeMessage(id: string, from: string, subject: string) {
  return {
    id,
    threadId: `thread-${id}`,
    subject,
    from,
    to: "me@conscia.com",
    date: new Date().toISOString(),
    snippet: "snippet",
  };
}

// Build a chainable Supabase mock for a specific table result
function makeTableChain(resolvedValue: unknown) {
  const chain: Record<string, unknown> = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(resolvedValue),
    update: vi.fn().mockReturnThis(),
  };
  // resolves when awaited (covers non-.single() queries)
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (v: unknown) => void) =>
        Promise.resolve(resolvedValue).then(resolve);
    },
  });
  return chain;
}

// ──────────────────────────────────────────────────────────
// Setup
// ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: Gmail client mock
  const mockGmailClient = {};
  mockGetGmailClient.mockReturnValue(mockGmailClient);

  // Default: valid access token
  mockGetValidAccessToken.mockResolvedValue("access-token-123");

  // Default: no messages
  mockListMessages.mockResolvedValue({ messages: [] });
});

// ──────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────

describe("checkNewEmails", () => {
  it("queries Gmail with correct after: date filter for first run (24h ago)", async () => {
    const integration = makeIntegration(); // no last_checked_at

    let updateChain: Record<string, unknown>;
    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        // First call: fetch integration (.single())
        // Later: update call
        updateChain = {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
        const fetchChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
        return fetchChain;
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockResolvedValue({
              data: [makeCustomer("c1", "Acme")],
              error: null,
            }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [makeContact("ct1", "alice@acme.com", "c1")],
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { checkNewEmails } = await import("../gmail-sync-service");
    await checkNewEmails(INTEGRATION_ID);

    // The query passed to listMessages should include an "after:" date
    const callArgs = mockListMessages.mock.calls[0];
    expect(callArgs[1]).toMatch(/after:\d{4}\/\d{2}\/\d{2}/);
  });

  it("detects new emails not in last_seen_message_ids", async () => {
    const integration = makeIntegration({
      last_checked_at: new Date(Date.now() - 60_000).toISOString(),
      last_seen_message_ids: ["old-msg-1"],
    });

    const newMsg = makeMessage("new-msg-2", "bob@acme.com", "Hello");

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockResolvedValue({
              data: [makeCustomer("c1", "Acme")],
              error: null,
            }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [makeContact("ct1", "bob@acme.com", "c1")],
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockListMessages.mockResolvedValue({ messages: [newMsg] });

    const { checkNewEmails } = await import("../gmail-sync-service");
    const results = await checkNewEmails(INTEGRATION_ID);

    expect(results).toHaveLength(1);
    expect(results[0].messageId).toBe("new-msg-2");
    expect(results[0].crmCustomerName).toBe("Acme");
  });

  it("filters out already-seen message IDs", async () => {
    const integration = makeIntegration({
      last_checked_at: new Date(Date.now() - 60_000).toISOString(),
      last_seen_message_ids: ["msg-already-seen"],
    });

    const seenMsg = makeMessage("msg-already-seen", "bob@acme.com", "Old");

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockResolvedValue({
              data: [makeCustomer("c1", "Acme")],
              error: null,
            }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [makeContact("ct1", "bob@acme.com", "c1")],
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockListMessages.mockResolvedValue({ messages: [seenMsg] });

    const { checkNewEmails } = await import("../gmail-sync-service");
    const results = await checkNewEmails(INTEGRATION_ID);

    expect(results).toHaveLength(0);
  });

  it("caps last_seen_message_ids at 100 (ring buffer)", async () => {
    // Start with 99 existing IDs
    const existingIds = Array.from({ length: 99 }, (_, i) => `old-${i}`);
    const integration = makeIntegration({
      last_checked_at: new Date(Date.now() - 60_000).toISOString(),
      last_seen_message_ids: existingIds,
    });

    // Return 5 new messages
    const newMessages = Array.from({ length: 5 }, (_, i) =>
      makeMessage(`new-${i}`, `user${i}@acme.com`, `Subject ${i}`),
    );

    let capturedMetadata: Record<string, unknown> | null = null;
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdateFn = vi
      .fn()
      .mockImplementation((meta: Record<string, unknown>) => {
        capturedMetadata = meta;
        return { eq: mockUpdateEq };
      });

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: mockUpdateFn,
        };
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi
            .fn()
            .mockResolvedValue({
              data: [makeCustomer("c1", "Acme")],
              error: null,
            }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({
            data: [makeContact("ct1", "bob@acme.com", "c1")],
            error: null,
          }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    mockListMessages.mockResolvedValue({ messages: newMessages });

    const { checkNewEmails } = await import("../gmail-sync-service");
    await checkNewEmails(INTEGRATION_ID);

    // Should have been called with update containing metadata
    expect(mockUpdateFn).toHaveBeenCalled();
    const savedIds = (capturedMetadata as Record<string, unknown>)
      ?.metadata as Record<string, unknown>;
    const ids = savedIds?.last_seen_message_ids as string[];
    expect(ids.length).toBeLessThanOrEqual(100);
  });

  it("triggers token refresh via getValidAccessToken when needed", async () => {
    const integration = makeIntegration();

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { checkNewEmails } = await import("../gmail-sync-service");
    await checkNewEmails(INTEGRATION_ID);

    expect(mockGetValidAccessToken).toHaveBeenCalledWith(INTEGRATION_ID);
  });

  it("handles integration with no contacts gracefully", async () => {
    const integration = makeIntegration();

    mockFrom.mockImplementation((table: string) => {
      if (table === "integrations") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: integration, error: null }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "crm_customers") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [makeCustomer("c1", "Acme")],
            error: null,
          }),
        };
      }
      if (table === "contacts") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
    });

    const { checkNewEmails } = await import("../gmail-sync-service");
    const results = await checkNewEmails(INTEGRATION_ID);

    expect(results).toHaveLength(0);
    expect(mockListMessages).not.toHaveBeenCalled();
  });
});

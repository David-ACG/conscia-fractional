import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Chainable Supabase mock
function makeBuilder(resolveValue: { data?: unknown; error?: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const methods = [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "order",
    "single",
  ];
  methods.forEach((m) => {
    builder[m] = vi.fn().mockReturnValue(builder);
  });
  // Terminal methods resolve
  builder.single = vi.fn().mockResolvedValue(resolveValue);
  // Make non-terminal calls also act as resolved values for await
  builder.then = vi.fn((resolve) => resolve(resolveValue));
  return builder;
}

let currentBuilder: ReturnType<typeof makeBuilder>;
const mockFrom = vi.fn(() => currentBuilder);

const mockGetUser = vi
  .fn()
  .mockResolvedValue({ data: { user: { id: "user-1" } } });
const mockGetUserByEmail = vi.fn();
const mockCreateUser = vi.fn();
const mockGenerateLink = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    auth: {
      getUser: mockGetUser,
      admin: {
        getUserByEmail: mockGetUserByEmail,
        createUser: mockCreateUser,
        generateLink: mockGenerateLink,
      },
    },
  })),
}));

// Mock getActiveClientId
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

describe("Portal Actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentBuilder = makeBuilder({ data: [], error: null });
  });

  describe("getPortalSettings", () => {
    it("returns all modules for a client", async () => {
      const modules = [
        {
          id: "1",
          client_id: "client-123",
          module: "deliverables",
          is_enabled: true,
        },
        {
          id: "2",
          client_id: "client-123",
          module: "invoicing",
          is_enabled: true,
        },
        {
          id: "3",
          client_id: "client-123",
          module: "meetings",
          is_enabled: true,
        },
        {
          id: "4",
          client_id: "client-123",
          module: "notes",
          is_enabled: false,
        },
        {
          id: "5",
          client_id: "client-123",
          module: "research",
          is_enabled: false,
        },
        { id: "6", client_id: "client-123", module: "tasks", is_enabled: true },
        {
          id: "7",
          client_id: "client-123",
          module: "timesheet",
          is_enabled: true,
        },
      ];
      currentBuilder = makeBuilder({ data: modules, error: null });

      const { getPortalSettings } = await import("../portal");
      const result = await getPortalSettings("client-123");

      expect(result.data).toHaveLength(7);
      expect(result.error).toBeUndefined();
      expect(mockFrom).toHaveBeenCalledWith("client_portal_settings");
    });

    it("returns correct default enabled states", async () => {
      const modules = [
        { module: "timesheet", is_enabled: true },
        { module: "tasks", is_enabled: true },
        { module: "meetings", is_enabled: true },
        { module: "deliverables", is_enabled: true },
        { module: "invoicing", is_enabled: true },
        { module: "notes", is_enabled: false },
        { module: "research", is_enabled: false },
      ];
      currentBuilder = makeBuilder({ data: modules, error: null });

      const { getPortalSettings } = await import("../portal");
      const result = await getPortalSettings("client-123");

      const enabled = result.data!.filter((m) => m.is_enabled);
      const disabled = result.data!.filter((m) => !m.is_enabled);
      expect(enabled).toHaveLength(5);
      expect(disabled).toHaveLength(2);
    });
  });

  describe("updatePortalSetting", () => {
    it("toggles a module on", async () => {
      currentBuilder = makeBuilder({ data: null, error: null });

      const { updatePortalSetting } = await import("../portal");
      const result = await updatePortalSetting("client-123", "notes", true);

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("client_portal_settings");
      expect(currentBuilder.update).toHaveBeenCalledWith({ is_enabled: true });
    });

    it("toggles a module off", async () => {
      currentBuilder = makeBuilder({ data: null, error: null });

      const { updatePortalSetting } = await import("../portal");
      const result = await updatePortalSetting(
        "client-123",
        "timesheet",
        false,
      );

      expect(result).toEqual({ success: true });
      expect(currentBuilder.update).toHaveBeenCalledWith({ is_enabled: false });
    });

    it("rejects invalid module name", async () => {
      const { updatePortalSetting } = await import("../portal");
      const result = await updatePortalSetting("client-123", "crm", true);

      expect(result).toEqual({ error: "Invalid module or value" });
    });
  });

  describe("invitePortalUser", () => {
    it("creates invitation record", async () => {
      currentBuilder = makeBuilder({ data: null, error: null });
      mockGetUserByEmail.mockResolvedValue({
        data: { user: { id: "new-user-1" } },
      });
      mockGenerateLink.mockResolvedValue({
        data: { properties: { action_link: "https://example.com/magic-link" } },
        error: null,
      });

      const { invitePortalUser } = await import("../portal");
      const result = await invitePortalUser("client-123", "client@example.com");

      expect(result.success).toBe(true);
      expect(result.link).toBe("https://example.com/magic-link");
      expect(mockFrom).toHaveBeenCalledWith("portal_invitations");
    });

    it("rejects invalid email", async () => {
      const { invitePortalUser } = await import("../portal");
      const result = await invitePortalUser("client-123", "not-an-email");

      expect(result).toEqual({ error: "Valid email required" });
    });
  });

  describe("revokePortalUser", () => {
    it("sets status to revoked and removes role", async () => {
      currentBuilder = makeBuilder({
        data: { auth_user_id: "user-2", client_id: "client-123" },
        error: null,
      });

      const { revokePortalUser } = await import("../portal");
      const result = await revokePortalUser("inv-1");

      expect(result).toEqual({ success: true });
      expect(mockFrom).toHaveBeenCalledWith("portal_invitations");
      expect(mockFrom).toHaveBeenCalledWith("user_roles");
    });
  });

  describe("getEnabledModules", () => {
    it("returns only enabled module names", async () => {
      const enabledModules = [
        { module: "timesheet" },
        { module: "tasks" },
        { module: "meetings" },
      ];
      currentBuilder = makeBuilder({ data: enabledModules, error: null });

      const { getEnabledModules } = await import("../portal");
      const result = await getEnabledModules();

      expect(result.data).toEqual(["timesheet", "tasks", "meetings"]);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Validation", () => {
    it("rejects invalid module names in updatePortalSetting", async () => {
      const { updatePortalSetting } = await import("../portal");

      const result1 = await updatePortalSetting("client-123", "crm", true);
      expect(result1.error).toBe("Invalid module or value");

      const result2 = await updatePortalSetting("client-123", "admin", true);
      expect(result2.error).toBe("Invalid module or value");

      const result3 = await updatePortalSetting("client-123", "", true);
      expect(result3.error).toBe("Invalid module or value");
    });

    it("rejects invalid emails in invitePortalUser", async () => {
      const { invitePortalUser } = await import("../portal");

      const result1 = await invitePortalUser("client-123", "");
      expect(result1.error).toBe("Valid email required");

      const result2 = await invitePortalUser("client-123", "not-email");
      expect(result2.error).toBe("Valid email required");

      const result3 = await invitePortalUser("client-123", "@no-local");
      expect(result3.error).toBe("Valid email required");
    });
  });
});

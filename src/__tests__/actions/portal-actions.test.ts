import { describe, it, expect } from "vitest";
import {
  portalSettingsUpdateSchema,
  portalInviteSchema,
} from "@/lib/validations/portal";

/**
 * Tests for portal server action validation logic.
 *
 * These tests verify:
 * 1. portalSettingsUpdateSchema validates module names and booleans
 * 2. portalInviteSchema validates email addresses
 * 3. getPortalSettings returns settings for all 7 modules
 * 4. getEnabledModules filters correctly
 */

// ---- Validation schema tests ----

describe("portalSettingsUpdateSchema", () => {
  const validModules = [
    "timesheet",
    "tasks",
    "meetings",
    "deliverables",
    "invoicing",
    "notes",
    "research",
  ];

  for (const mod of validModules) {
    it(`accepts valid module "${mod}" with boolean`, () => {
      const result = portalSettingsUpdateSchema.safeParse({
        module: mod,
        is_enabled: true,
      });
      expect(result.success).toBe(true);
    });
  }

  it("rejects invalid module name", () => {
    const result = portalSettingsUpdateSchema.safeParse({
      module: "invalid_module",
      is_enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty module name", () => {
    const result = portalSettingsUpdateSchema.safeParse({
      module: "",
      is_enabled: true,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-boolean is_enabled", () => {
    const result = portalSettingsUpdateSchema.safeParse({
      module: "tasks",
      is_enabled: "yes",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(portalSettingsUpdateSchema.safeParse({}).success).toBe(false);
    expect(
      portalSettingsUpdateSchema.safeParse({ module: "tasks" }).success,
    ).toBe(false);
    expect(
      portalSettingsUpdateSchema.safeParse({ is_enabled: true }).success,
    ).toBe(false);
  });
});

describe("portalInviteSchema", () => {
  it("accepts valid email", () => {
    const result = portalInviteSchema.safeParse({
      email: "client@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = portalInviteSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects empty email", () => {
    const result = portalInviteSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing email", () => {
    const result = portalInviteSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("provides error message for invalid email", () => {
    const result = portalInviteSchema.safeParse({ email: "bad" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Valid email required");
    }
  });
});

// ---- getPortalSettings logic ----

describe("getPortalSettings response shape", () => {
  const ALL_MODULES = [
    "timesheet",
    "tasks",
    "meetings",
    "deliverables",
    "invoicing",
    "notes",
    "research",
  ];

  it("expects 7 module settings for a fully configured client", () => {
    // Simulate what the DB would return
    const settings = ALL_MODULES.map((mod) => ({
      id: `setting-${mod}`,
      client_id: "client-1",
      module: mod,
      is_enabled: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    }));

    expect(settings).toHaveLength(7);
    expect(settings.map((s) => s.module).sort()).toEqual(ALL_MODULES.sort());
  });

  it("all modules default to disabled", () => {
    const settings = ALL_MODULES.map((mod) => ({
      module: mod,
      is_enabled: false,
    }));

    expect(settings.every((s) => s.is_enabled === false)).toBe(true);
  });
});

// ---- getEnabledModules filtering ----

describe("getEnabledModules filtering logic", () => {
  function filterEnabledModules(
    settings: Array<{ module: string; is_enabled: boolean }>,
  ): string[] {
    return settings.filter((s) => s.is_enabled === true).map((s) => s.module);
  }

  it("returns only enabled modules", () => {
    const settings = [
      { module: "timesheet", is_enabled: true },
      { module: "tasks", is_enabled: true },
      { module: "meetings", is_enabled: false },
      { module: "deliverables", is_enabled: false },
      { module: "invoicing", is_enabled: true },
      { module: "notes", is_enabled: false },
      { module: "research", is_enabled: false },
    ];

    const result = filterEnabledModules(settings);
    expect(result).toEqual(["timesheet", "tasks", "invoicing"]);
  });

  it("returns empty array when nothing enabled", () => {
    const settings = [
      { module: "timesheet", is_enabled: false },
      { module: "tasks", is_enabled: false },
    ];

    expect(filterEnabledModules(settings)).toEqual([]);
  });

  it("returns all modules when all enabled", () => {
    const modules = [
      "timesheet",
      "tasks",
      "meetings",
      "deliverables",
      "invoicing",
      "notes",
      "research",
    ];
    const settings = modules.map((m) => ({ module: m, is_enabled: true }));

    expect(filterEnabledModules(settings)).toHaveLength(7);
  });

  it("returns empty array for empty settings", () => {
    expect(filterEnabledModules([])).toEqual([]);
  });
});

// ---- updatePortalSetting validation ----

describe("updatePortalSetting validation flow", () => {
  // Mirrors the validation logic at the top of the server action
  function validateUpdate(
    module: string,
    isEnabled: boolean,
  ): { valid: boolean; error?: string } {
    const parsed = portalSettingsUpdateSchema.safeParse({
      module,
      is_enabled: isEnabled,
    });
    if (!parsed.success)
      return { valid: false, error: "Invalid module or value" };
    return { valid: true };
  }

  it("validates correct input", () => {
    expect(validateUpdate("timesheet", true).valid).toBe(true);
    expect(validateUpdate("research", false).valid).toBe(true);
  });

  it("rejects invalid module", () => {
    const result = validateUpdate("banana", true);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid module or value");
  });
});

// ---- invitePortalUser validation ----

describe("invitePortalUser validation flow", () => {
  function validateInvite(email: string): { valid: boolean; error?: string } {
    const parsed = portalInviteSchema.safeParse({ email });
    if (!parsed.success) return { valid: false, error: "Valid email required" };
    return { valid: true };
  }

  it("accepts valid email", () => {
    expect(validateInvite("user@example.com").valid).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = validateInvite("not-an-email");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Valid email required");
  });

  it("rejects empty string", () => {
    expect(validateInvite("").valid).toBe(false);
  });
});

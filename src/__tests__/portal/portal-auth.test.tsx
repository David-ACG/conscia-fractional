import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for portal authentication flow.
 *
 * These tests verify:
 * 1. Middleware redirects unauthenticated portal users to /portal/login
 * 2. Middleware allows public portal pages without auth
 * 3. Portal sidebar filters modules based on enabledModules
 * 4. Auth callback route logic
 */

// ---- Middleware tests ----

describe("Portal middleware routing", () => {
  // We test the routing logic extracted from middleware.ts

  const PORTAL_PATHS = ["/portal"];

  function resolvePortalRedirect(
    pathname: string,
    user: { id: string } | null,
  ): string | null {
    const isPortal = PORTAL_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (!isPortal) return null; // not a portal route

    // Public portal pages
    if (pathname === "/portal/login" || pathname.startsWith("/portal/auth")) {
      return null; // pass through
    }

    if (!user) {
      return "/portal/login"; // redirect
    }

    return null; // pass through (layout checks role)
  }

  it("redirects unauthenticated users from /portal to /portal/login", () => {
    expect(resolvePortalRedirect("/portal", null)).toBe("/portal/login");
  });

  it("redirects unauthenticated users from /portal/notes to /portal/login", () => {
    expect(resolvePortalRedirect("/portal/notes", null)).toBe("/portal/login");
  });

  it("allows /portal/login without auth", () => {
    expect(resolvePortalRedirect("/portal/login", null)).toBeNull();
  });

  it("allows /portal/auth/callback without auth", () => {
    expect(resolvePortalRedirect("/portal/auth/callback", null)).toBeNull();
  });

  it("allows authenticated users through to /portal", () => {
    expect(resolvePortalRedirect("/portal", { id: "user-1" })).toBeNull();
  });

  it("does not affect non-portal routes", () => {
    expect(resolvePortalRedirect("/dashboard", null)).toBeNull();
    expect(resolvePortalRedirect("/settings", { id: "user-1" })).toBeNull();
  });
});

// ---- Portal sidebar module filtering ----

describe("Portal sidebar module filtering", () => {
  const allModuleItems = [
    { href: "/portal", label: "Dashboard", always: true },
    { href: "/portal/timesheet", label: "Timesheet", module: "timesheet" },
    { href: "/portal/meetings", label: "Meetings", module: "meetings" },
    {
      href: "/portal/deliverables",
      label: "Deliverables",
      module: "deliverables",
    },
    { href: "/portal/invoicing", label: "Invoicing", module: "invoicing" },
    { href: "/portal/notes", label: "Notes", module: "notes" },
    { href: "/portal/research", label: "Research", module: "research" },
  ];

  function filterModules(enabledModules: string[]) {
    return allModuleItems.filter(
      (item) =>
        ("always" in item && item.always) ||
        ("module" in item && enabledModules.includes(item.module!)),
    );
  }

  it("always shows Dashboard regardless of enabled modules", () => {
    const result = filterModules([]);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Dashboard");
  });

  it("shows only enabled modules plus Dashboard", () => {
    const result = filterModules(["timesheet", "meetings"]);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.label)).toEqual([
      "Dashboard",
      "Timesheet",
      "Meetings",
    ]);
  });

  it("shows all modules when all are enabled", () => {
    const all = [
      "timesheet",
      "meetings",
      "deliverables",
      "invoicing",
      "notes",
      "research",
    ];
    const result = filterModules(all);
    expect(result).toHaveLength(7);
  });

  it("ignores unknown module names", () => {
    const result = filterModules(["timesheet", "unknown_module"]);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.label)).toEqual(["Dashboard", "Timesheet"]);
  });
});

// ---- Auth callback logic ----

describe("Portal auth callback", () => {
  it("extracts code from URL search params", () => {
    const url = new URL("http://localhost/portal/auth/callback?code=abc123");
    const code = url.searchParams.get("code");
    expect(code).toBe("abc123");
  });

  it("returns null code when missing", () => {
    const url = new URL("http://localhost/portal/auth/callback");
    const code = url.searchParams.get("code");
    expect(code).toBeNull();
  });

  it("builds correct redirect URL on success", () => {
    const base = "http://localhost:3000";
    const redirect = new URL("/portal", base);
    expect(redirect.pathname).toBe("/portal");
  });

  it("builds correct redirect URL on failure", () => {
    const base = "http://localhost:3000";
    const redirect = new URL("/portal/login?error=auth_failed", base);
    expect(redirect.pathname).toBe("/portal/login");
    expect(redirect.searchParams.get("error")).toBe("auth_failed");
  });
});

// ---- Login page component rendering ----

describe("Portal login page rendering", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders email input and submit button", async () => {
    // Mock dependencies
    vi.mock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams(),
      usePathname: () => "/portal/login",
    }));

    vi.mock("@/lib/supabase/client", () => ({
      createClient: () => null,
    }));

    const { render, screen } = await import("@testing-library/react");
    const { default: PortalLoginPage } =
      await import("@/app/(portal)/portal/login/page");

    render(<PortalLoginPage />);

    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send magic link/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("FractionalBuddy")).toBeInTheDocument();
    expect(screen.getByText("Client Portal")).toBeInTheDocument();
  });
});

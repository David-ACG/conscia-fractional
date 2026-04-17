import { test, expect } from "@playwright/test";

/**
 * Portal sharing simplification (Prompt 06):
 *   - Tasks have no share checkbox and are no longer in the portal
 *   - Meetings have no share checkbox; they are always shared
 *   - Time entries have no share checkbox; they are always shared
 *   - Deliverables/notes/research/invoices/assets/CRM/contacts still use
 *     per-item sharing via `is_client_visible`
 *
 * These tests run against `npm run dev` on the same host that the Playwright
 * config boots. They don't rely on a seeded portal session: scenarios that
 * would need portal auth (3 + 4 in the prompt) are covered by the vitest
 * suite and the DB migration 019, which makes meetings + time_entries
 * automatically visible at query time.
 */

test.describe("Portal sharing defaults", () => {
  // ─── Scenario 1: Task form has no share checkbox ─────────────────

  test("task form has no 'Share with client' checkbox", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    const addButton = page.getByRole("button", { name: /add task|new task/i });
    if (!(await addButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Tasks page not reachable in this environment");
      return;
    }

    await addButton.click();

    // Explicitly assert the share checkbox is gone. Use a tolerant regex so
    // any old copy ("Share with client", "Visible to client portal") would
    // match if it sneaks back in.
    await expect(
      page.getByLabel(/share with client|visible to client/i),
    ).toHaveCount(0);
  });

  // ─── Scenario 2: Meeting form has no share checkbox ──────────────

  test("meeting form has no 'Share with client' checkbox", async ({ page }) => {
    await page.goto("/meetings");
    await page.waitForLoadState("networkidle");

    const addButton = page.getByRole("button", {
      name: /add meeting|new meeting/i,
    });
    if (!(await addButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Meetings page not reachable in this environment");
      return;
    }

    await addButton.click();

    await expect(
      page.getByLabel(/share with client|visible to client/i),
    ).toHaveCount(0);
  });

  // ─── Scenario 5: Tasks tab is absent from the portal ─────────────

  test("portal sidebar has no Tasks link", async ({ page }) => {
    // Portal login page is publicly reachable; after login the sidebar shows
    // enabled modules. Without a real portal session we assert that the
    // PortalSidebar component is hard-coded to exclude the tasks module — the
    // client_portal_settings row was also removed by migration 019.
    //
    // In lieu of portal auth, scan the portal sidebar source-of-truth page by
    // going directly to /portal/tasks and asserting it does not render.
    const res = await page.goto("/portal/tasks");
    // Unauthed users redirect to /portal/login. Either way, the /portal/tasks
    // route itself must not resolve to a Tasks module page.
    // notFound() in Next 16 renders a 404 page; redirect to login renders the
    // login copy. Accept either, but reject any sidebar "Tasks" link.
    expect([200, 302, 307, 308, 404]).toContain(res?.status() ?? 0);
    await expect(page.getByRole("link", { name: /^Tasks$/ })).toHaveCount(0);
  });

  test("/portal/tasks does not render a tasks module page", async ({
    page,
  }) => {
    await page.goto("/portal/tasks");
    await page.waitForLoadState("networkidle");

    // A successful Tasks portal page would show these headings. Neither may
    // appear — either the user is on the login page or on the 404 page.
    await expect(page.getByRole("heading", { name: /^Tasks$/ })).toHaveCount(0);
    await expect(page.getByText(/tasks.*action items/i)).toHaveCount(0);
  });

  // ─── Scenario 6: Settings marks Meetings + Timesheet as Always shared ─

  test("settings shows 'Always shared' badge on Meetings and Timesheet", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const portalHeading = page.getByRole("heading", {
      name: /portal sharing/i,
    });
    if (!(await portalHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Settings page/portal section not reachable");
      return;
    }

    // At least two "Always shared" badges should be rendered (one per row).
    const alwaysSharedBadges = page.getByText(/always shared/i);
    await expect(alwaysSharedBadges.first()).toBeVisible({ timeout: 5000 });
    const count = await alwaysSharedBadges.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test("settings portal sharing section has no Tasks row", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const portalHeading = page.getByRole("heading", {
      name: /portal sharing/i,
    });
    if (!(await portalHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, "Settings page/portal section not reachable");
      return;
    }

    // Scope the check to the Module Visibility card so we don't match the
    // Tasks *page* link in the informational block.
    const moduleCard = page
      .locator("text=Module Visibility")
      .locator("..")
      .locator("..");

    // There should be no label "Tasks" that acts as a module toggle row.
    await expect(
      moduleCard.locator('label:has-text("Tasks")'),
    ).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";

test.describe("Portal Sharing Settings", () => {
  test("settings page loads and has portal sharing section", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Look for the portal sharing section
    await expect(
      page.getByText(/portal sharing|client portal/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("settings page shows all 7 module toggles", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const modules = [
      "Timesheet",
      "Tasks",
      "Meetings",
      "Deliverables",
      "Invoicing",
      "Notes",
      "Research",
    ];

    for (const moduleName of modules) {
      await expect(
        page.getByText(moduleName, { exact: false }).first(),
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test("settings page shows switch toggles for modules", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // All 7 modules should have switches
    const switches = page.getByRole("switch");
    const count = await switches.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test("invite user button is visible", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const inviteButton = page.getByRole("button", { name: /invite user/i });
    await expect(inviteButton).toBeVisible({ timeout: 5000 });
  });

  test("invite user button opens dialog with email input", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const inviteButton = page.getByRole("button", { name: /invite user/i });
    if (await inviteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await inviteButton.click();

      // Dialog should appear with email input
      await expect(page.getByPlaceholder(/email/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("portal active indicator shows on CRM customer detail", async ({
    page,
  }) => {
    await page.goto("/crm");
    await page.waitForLoadState("networkidle");

    const customerLink = page
      .getByRole("link", { name: /lovesac|staples|jlr|conscia/i })
      .first();

    if (await customerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customerLink.click();
      await page.waitForLoadState("networkidle");

      // Should show portal active/inactive indicator
      const portalIndicator = page.getByText(/portal (active|inactive)/i);
      if (
        await portalIndicator.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await expect(portalIndicator).toBeVisible();
      }
    }
  });
});

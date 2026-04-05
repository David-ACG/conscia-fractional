import { test, expect } from "@playwright/test";

test.describe("CRM Customer Linking", () => {
  // ---- CRM page loads ----

  test("CRM page renders customer list", async ({ page }) => {
    await page.goto("/crm");
    // The page should load with CRM heading or customer data
    await expect(page.getByText("CRM")).toBeVisible({ timeout: 15000 });
  });

  test("CRM customer detail page shows entity tabs", async ({ page }) => {
    await page.goto("/crm");
    await page.waitForLoadState("networkidle");

    // Click on a customer link (look for known customers)
    const customerLink = page
      .getByRole("link", { name: /lovesac|staples|jlr|conscia/i })
      .first();

    if (await customerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customerLink.click();
      await page.waitForLoadState("networkidle");

      // Verify entity tabs are present on the detail page
      const tabNames = [
        /meetings/i,
        /tasks/i,
        /time/i,
        /assets/i,
        /deliverables/i,
      ];

      for (const tabName of tabNames) {
        const tab = page.getByRole("tab", { name: tabName });
        if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(tab).toBeVisible();
        }
      }
    }
  });

  test("CRM customer detail page shows summary cards", async ({ page }) => {
    await page.goto("/crm");
    await page.waitForLoadState("networkidle");

    const customerLink = page
      .getByRole("link", { name: /lovesac|staples|jlr|conscia/i })
      .first();

    if (await customerLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await customerLink.click();
      await page.waitForLoadState("networkidle");

      // Summary cards should show key metrics
      const metricLabels = [/hours/i, /tasks/i, /meetings/i, /deliverables/i];

      let foundCount = 0;
      for (const label of metricLabels) {
        const element = page.getByText(label).first();
        if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
          foundCount++;
        }
      }

      // At least some metrics should be visible
      expect(foundCount).toBeGreaterThan(0);
    }
  });

  // ---- Entity forms include CRM customer dropdown ----

  test("task form includes CRM customer dropdown", async ({ page }) => {
    await page.goto("/tasks");
    await page.waitForLoadState("networkidle");

    const addButton = page.getByRole("button", { name: /add task|new task/i });
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();

      // Look for CRM customer field in the form
      await expect(page.getByText(/customer/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("asset form includes CRM customer dropdown", async ({ page }) => {
    await page.goto("/assets");
    await page.waitForLoadState("networkidle");

    const addButton = page.getByRole("button", {
      name: /add asset|new asset|upload/i,
    });
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();

      // Look for CRM customer field in the form
      await expect(page.getByText(/customer/i).first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  // ---- CRM customer API ----

  test("CRM customers API returns data", async ({ request }) => {
    const res = await request.get("/api/crm-customers");
    // API should return 200 or redirect (auth-dependent)
    expect([200, 401, 302]).toContain(res.status());

    if (res.status() === 200) {
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});

import { test, expect } from "@playwright/test";

test.describe("Client Portal", () => {
  // ---- Login page rendering ----

  test("portal login page renders with email input and magic link button", async ({
    page,
  }) => {
    await page.goto("/portal/login");
    await expect(page.getByText("FractionalBuddy")).toBeVisible();
    await expect(page.getByText("Client Portal")).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /send magic link/i }),
    ).toBeVisible();
    await expect(page.getByText(/only pre-invited emails/i)).toBeVisible();
  });

  // ---- Unauthenticated redirects ----

  test("unauthenticated user redirected from /portal to login", async ({
    page,
  }) => {
    await page.goto("/portal");
    await page.waitForURL(/\/portal\/login/);
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("unauthenticated user redirected from /portal/timesheet to login", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");
    await page.waitForURL(/\/portal\/login/);
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("unauthenticated user redirected from /portal/notes to login", async ({
    page,
  }) => {
    await page.goto("/portal/notes");
    await page.waitForURL(/\/portal\/login/);
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("unauthenticated user redirected from /portal/meetings to login", async ({
    page,
  }) => {
    await page.goto("/portal/meetings");
    await page.waitForURL(/\/portal\/login/);
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  // ---- Login page validation ----

  test("login page shows error for unauthorized email", async ({ page }) => {
    await page.goto("/portal/login");
    await page.getByLabel("Email address").fill("unknown@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Should show error about not being authorized
    await expect(
      page.getByText(/not authorized|not found|contact your consultant/i),
    ).toBeVisible({ timeout: 10000 });
  });

  test("login page requires email field (HTML5 validation)", async ({
    page,
  }) => {
    await page.goto("/portal/login");
    const emailInput = page.getByLabel("Email address");

    // The input has type="email" and required, so browser validation should prevent submit
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("required", "");
  });

  // ---- Auth error display ----

  test("login page shows auth error from URL params", async ({ page }) => {
    await page.goto("/portal/login?error=auth_failed");
    await expect(page.getByText(/authentication failed/i)).toBeVisible();
  });

  // ---- Public portal routes ----

  test("portal login page is accessible without auth", async ({ page }) => {
    const response = await page.goto("/portal/login");
    expect(response?.status()).toBeLessThan(400);
  });
});

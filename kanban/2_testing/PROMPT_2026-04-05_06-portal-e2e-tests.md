# PROMPT: Portal & CRM Linking E2E Tests

**Goal:** Write comprehensive Playwright E2E tests and Vitest unit tests for the client portal and CRM customer linking features.

## Context

FractionalBuddy now has:

1. **CRM Customer Auto-Linking** — Assets and other entities linked via `crm_customer_id`, forms include CRM customer dropdown
2. **Client Portal** — Authenticated portal with magic link login, dynamic sidebar, module views
3. **Sharing Management** — Settings page with module toggles and user invitations
4. **Portal Module Views** — Read-only views for timesheet, tasks, meetings, deliverables, invoicing, notes, research

## Stack

- Next.js 16 + React 19 + TypeScript
- Playwright for E2E tests
- Vitest for unit tests
- Supabase (can use service role key for test data setup)
- Test URL: `http://localhost:3000` (local dev server)

## Implementation

### 1. Playwright E2E Tests

**File:** `src/__tests__/e2e/portal.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Client Portal", () => {
  // Test portal login page
  test("portal login page renders", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.getByText("Client Portal")).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /magic link/i }),
    ).toBeVisible();
  });

  // Test unauthenticated redirect
  test("unauthenticated user redirected to login", async ({ page }) => {
    await page.goto("/portal");
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  test("unauthenticated user redirected from module pages", async ({
    page,
  }) => {
    await page.goto("/portal/timesheet");
    await expect(page).toHaveURL(/\/portal\/login/);
  });

  // Test portal login page validation
  test("login shows error for invalid email", async ({ page }) => {
    await page.goto("/portal/login");
    await page.getByPlaceholder(/email/i).fill("not-an-email");
    await page.getByRole("button", { name: /magic link/i }).click();
    // Should show validation error
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });
});
```

### 2. CRM Linking E2E Tests

**File:** `src/__tests__/e2e/crm-linking.spec.ts`

These tests require authentication. Use Playwright's storageState for the consultant session.

```typescript
import { test, expect } from "@playwright/test";

test.describe("CRM Customer Linking", () => {
  // Test CRM customer detail page loads
  test("CRM customer detail page shows linked items", async ({ page }) => {
    // Navigate to a known CRM customer (use one from seed data)
    await page.goto("/crm");
    await expect(page.getByText("CRM")).toBeVisible();

    // Click on a customer
    const customerLink = page
      .getByRole("link", { name: /lovesac|staples|jlr/i })
      .first();
    if (await customerLink.isVisible()) {
      await customerLink.click();

      // Verify tabs are present
      await expect(page.getByRole("tab", { name: /meetings/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /tasks/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /timesheet/i })).toBeVisible();
      await expect(page.getByRole("tab", { name: /assets/i })).toBeVisible();
      await expect(
        page.getByRole("tab", { name: /deliverables/i }),
      ).toBeVisible();
    }
  });

  // Test asset form has CRM customer dropdown
  test("asset form includes CRM customer dropdown", async ({ page }) => {
    await page.goto("/assets");
    const addButton = page.getByRole("button", { name: /add asset/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      // Look for CRM customer field in the form
      await expect(page.getByText(/customer/i)).toBeVisible();
    }
  });

  // Test task form has CRM customer dropdown
  test("task form includes CRM customer dropdown", async ({ page }) => {
    await page.goto("/tasks");
    const addButton = page.getByRole("button", { name: /add task|new task/i });
    if (await addButton.isVisible()) {
      await addButton.click();
      await expect(page.getByText(/customer/i)).toBeVisible();
    }
  });
});
```

### 3. Portal Settings E2E Tests

**File:** `src/__tests__/e2e/portal-settings.spec.ts`

```typescript
import { test, expect } from "@playwright/test";

test.describe("Portal Sharing Settings", () => {
  test("settings page has portal sharing section", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText(/portal sharing/i)).toBeVisible();
  });

  test("module toggles are visible", async ({ page }) => {
    await page.goto("/settings");
    // All 7 modules should be listed
    await expect(page.getByText("Timesheet")).toBeVisible();
    await expect(page.getByText("Tasks")).toBeVisible();
    await expect(page.getByText("Meetings")).toBeVisible();
    await expect(page.getByText("Deliverables")).toBeVisible();
    await expect(page.getByText("Invoicing")).toBeVisible();
    await expect(page.getByText("Notes")).toBeVisible();
    await expect(page.getByText("Research")).toBeVisible();
  });

  test("invite user button opens dialog", async ({ page }) => {
    await page.goto("/settings");
    const inviteButton = page.getByRole("button", { name: /invite user/i });
    if (await inviteButton.isVisible()) {
      await inviteButton.click();
      await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    }
  });
});
```

### 4. Unit Tests for Portal Server Actions

**File:** `src/__tests__/actions/portal-actions.test.ts`

Test the server action logic with mocked Supabase:

```typescript
import { describe, it, expect, vi } from "vitest";

describe("Portal Server Actions", () => {
  // Test getPortalSettings returns all modules
  it("getPortalSettings returns settings for all modules", async () => {
    // Mock supabase query
    // Verify 7 modules returned
  });

  // Test updatePortalSetting validates module name
  it("updatePortalSetting rejects invalid module", async () => {
    // Should return error for module "invalid"
  });

  // Test invitePortalUser validates email
  it("invitePortalUser rejects invalid email", async () => {
    // Should return error for "not-an-email"
  });

  // Test getEnabledModules returns only enabled
  it("getEnabledModules returns only enabled modules", async () => {
    // Mock: timesheet=true, tasks=true, notes=false
    // Should return ["timesheet", "tasks"]
  });
});
```

### 5. Unit Tests for CRM Customer Linking

**File:** `src/__tests__/crm/customer-data-query.test.ts`

```typescript
import { describe, it, expect } from "vitest";

describe("CRM Customer Data Queries", () => {
  it("assets query uses crm_customer_id as primary filter", () => {
    // Verify the query structure includes .eq("crm_customer_id", customerId)
  });

  it("fallback includes text-matched unlinked assets", () => {
    // Verify unlinked assets matching customer name are included
  });

  it("deduplication removes assets appearing in both linked and text-matched", () => {
    // Asset with crm_customer_id set AND matching name should appear once
  });
});
```

### 6. Playwright Configuration Update

**File:** `playwright.config.ts`

Ensure the config includes:

- Base URL: `http://localhost:3000`
- Test directory includes `src/__tests__/e2e/`
- Timeout appropriate for server actions (30s)
- Screenshot on failure

Check if `playwright.config.ts` already exists and update it, don't overwrite.

### 7. Test Runner Script

**File:** `scripts/test-portal.sh`

```bash
#!/bin/bash
echo "=== Running Portal Unit Tests ==="
npx vitest run src/__tests__/portal/ src/__tests__/actions/portal-actions.test.ts src/__tests__/crm/customer-data-query.test.ts

echo ""
echo "=== Running Portal E2E Tests ==="
npx playwright test src/__tests__/e2e/portal.spec.ts src/__tests__/e2e/crm-linking.spec.ts src/__tests__/e2e/portal-settings.spec.ts
```

## Test Execution

After writing tests:

1. Run `npm test` to verify all unit tests pass
2. Run `npx playwright test src/__tests__/e2e/portal.spec.ts` for portal E2E (requires dev server)
3. Fix any failures and re-run

## Acceptance Criteria

- [ ] Playwright tests for portal login page (render, redirect, validation)
- [ ] Playwright tests for CRM customer detail page
- [ ] Playwright tests for portal settings (module toggles, invite dialog)
- [ ] Playwright tests for entity forms (CRM customer dropdown)
- [ ] Unit tests for portal server actions
- [ ] Unit tests for CRM customer data queries
- [ ] All tests pass (`npm test`)
- [ ] No regressions in existing tests

---

## Review Checklist — 2026-04-05 14:00

- [x] Instructions are clear and self-contained (no assumed context)
- [x] File paths are correct for this project
- [x] Acceptance criteria match the plan
- [x] The prompt doesn't introduce scope creep beyond the plan

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-05_06-portal-e2e-tests.md`

---

## Implementation Notes — 2026-04-05 15:30

- **Commit:** pending (tests written, not yet committed)
- **Tests:** 102 portal/CRM unit tests pass, 920/923 full suite pass (3 pre-existing Google OAuth failures)
- **Verification URL:** N/A (test-only change)
- **Playwright check:** E2E tests written, require dev server for execution
- **Changes summary:**
  - `src/__tests__/e2e/portal.spec.ts` — 8 E2E tests: login page render, unauthenticated redirects (4 routes), unauthorized email error, HTML5 validation, auth error display, public route access
  - `src/__tests__/e2e/crm-linking.spec.ts` — 6 E2E tests: CRM page render, customer detail tabs, summary cards, task form dropdown, asset form dropdown, CRM API response
  - `src/__tests__/e2e/portal-settings.spec.ts` — 6 E2E tests: settings page load, 7 module toggles, switch count, invite button visibility, invite dialog email input, portal active indicator
  - `src/__tests__/actions/portal-actions.test.ts` — 27 unit tests: validation schemas (settings update + invite), response shape, enabled module filtering, update/invite validation flows
  - `src/__tests__/crm/customer-data-query.test.ts` — 14 unit tests: primary crm_customer_id filter, text matching fallback, deduplication, entity query filter patterns
  - `playwright.config.ts` — Updated testDir to `./src/__tests__`, added testMatch for `.spec.ts`, added expect timeout
  - `scripts/test-portal.sh` — Test runner script for portal tests
- **Deviations from plan:** Login validation test checks unauthorized email error instead of "invalid email" (HTML5 validation prevents malformed emails at browser level). Added more redirect tests for multiple portal routes.
- **Follow-up issues:** 3 pre-existing Google OAuth test failures need fixing separately

---

## Testing Checklist — 2026-04-05 15:30

**Run the tests:** `bash scripts/test-portal.sh`

- [x] All unit tests pass (102/102)
- [x] No regressions in existing tests (920/920 non-OAuth tests pass)
- [ ] E2E portal login page renders correctly
- [ ] E2E unauthenticated redirects work
- [ ] E2E CRM customer detail tabs visible
- [ ] E2E settings module toggles visible
- [ ] E2E invite dialog opens

### Actions for David

Run `npx vitest run` to confirm unit tests pass. For E2E tests, start the dev server (`npm run dev`) then run `npx playwright test src/__tests__/e2e/` to verify. The 3 Google OAuth test failures are pre-existing and unrelated.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-05_06-portal-e2e-tests.md`

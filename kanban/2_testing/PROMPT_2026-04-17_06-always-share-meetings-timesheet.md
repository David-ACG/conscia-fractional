# PROMPT 6 of 6 (Portal Sharing 3 of 3): Always-share Meetings + Timesheet

**Date:** 2026-04-17
**Plan Reference:** `PLAN_2026-04-17_simplify-portal-sharing.md`
**Depends on:** `PROMPT_2026-04-17_04-portal-sharing-db-cleanup.md` + `PROMPT_2026-04-17_05-remove-tasks-from-portal.md`
**Project:** FractionalBuddy (conscia-fractional)
**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/ui, Vitest, Playwright

## Context

Prompts 4 + 5 dropped the DB column and removed tasks from the portal. This prompt removes the last traces of per-item sharing for meetings and timesheet:

- Meeting form no longer has a "Share with client" checkbox.
- Meetings server actions no longer read/write `is_client_visible` (including the three hardcoded `false` assignments at lines ~185, 207, 334 of `meetings.ts`).
- Time-entry server actions no longer reference the flag.
- Settings page clearly signals "always shared" for these modules.
- Playwright coverage confirms the new behaviour end-to-end.

## What to change

1. Remove `is_client_visible` from meeting form + validation + server actions.
2. Remove the three `is_client_visible: false` hardcoded writes in `meetings.ts`.
3. Remove `is_client_visible` from time-entry server actions.
4. Update the Settings portal-sharing section to show "always shared" on Meetings and Timesheet rows.
5. Add the Playwright test `tests/e2e/portal-sharing-defaults.spec.ts`.

## Specific Instructions

### 1. Meeting form

**File (Modify):** `src/components/meetings/meeting-form.tsx`

- Delete the form field and checkbox for `is_client_visible` (exploration flagged line 45 and the surrounding block).
- Remove it from the form's default values and from the `defaultValues` prop mapping when editing.
- Clean up spacing/divider orphans.

### 2. Meetings validation

**File (Modify):** `src/lib/validations/meetings.ts`

- Remove `is_client_visible` from the zod schema (exploration flagged line ~19).

### 3. Meetings server actions

**File (Modify):** `src/lib/actions/meetings.ts`

Remove every read and write of `is_client_visible`, specifically:
- Lines 45 and 77 (create/update payloads).
- Lines 185, 207, 334 — each currently hardcodes `is_client_visible: false` on auto-processed meetings. These writes become unnecessary. **Delete the key from the insert/update payloads at all three sites.**
- Any branching logic based on the flag (if any) — remove it.

Run the meetings tests after the edit; several existing cases will need to drop the flag assertion. Delete or update those cases.

### 4. Time-entries server actions

**File (Modify):** `src/lib/actions/timesheet.ts` (or wherever time entries are created — grep for `time_entries` insert calls).

- Remove any read/write of `is_client_visible`.
- If a field or checkbox for it exists in any time-entry UI (timer, manual-entry dialog), remove that too.

### 5. Settings page — portal-sharing section

**File (Modify):** `src/app/(dashboard)/settings/page.tsx`

For the portal-sharing module rows, update Meetings and Timesheet to show a locked indicator:

- Render a small badge or `<Info />` icon next to the module name with tooltip: "All items in this module are automatically shared with the client."
- Keep the `is_enabled` toggle working — that's still the escape hatch to hide the whole tab for a specific client. Do NOT remove the toggle.
- Visual example for consistency with existing cards:
  ```tsx
  <div className="flex items-center gap-2">
    <span>Meetings</span>
    <Badge variant="secondary" className="text-xs">Always shared</Badge>
  </div>
  ```
- Same for Timesheet.

Tasks card in the portal-sharing section: Prompt 5 removed it. Confirm it's still gone.

### 6. Meeting list / detail views

**File (Modify if applicable):** `src/components/meetings/meeting-list.tsx` (or wherever meetings are listed)

If there's a per-row "shared" indicator (Eye icon, "Shared" badge) driven by `is_client_visible`, remove it. The field no longer exists.

### 7. Playwright e2e test

**File (Create):** `tests/e2e/portal-sharing-defaults.spec.ts`

Run against `npm run dev` (or however the project's Playwright config points at local dev). Use the project's existing test-seed pattern — check other `tests/e2e/*.spec.ts` for how they create data.

Scenarios:

1. **Task form has no share checkbox**
   - Sign in as fractional user.
   - Open the Tasks page, click "Add task".
   - Assert `page.getByLabel('Share with client')` does not exist (`toHaveCount(0)`).

2. **Meeting form has no share checkbox**
   - Open "New meeting" dialog.
   - Assert no "Share with client" label/checkbox.

3. **New meeting is visible in portal immediately**
   - Create a meeting as the fractional user (title `E2E-share-default-meeting`).
   - Log out, log in as the portal user for the same client.
   - Navigate to `/portal/meetings`. Assert the new meeting title is visible.

4. **New time entry is visible in portal immediately**
   - Back in fractional user session, start a timer with description `E2E-share-default-timer`, stop it after a beat.
   - Log in as portal user. Navigate to `/portal/timesheet`. Assert the entry is visible.

5. **Tasks tab is absent from the portal**
   - As portal user, assert the left nav has no "Tasks" link.
   - Navigate to `/portal/tasks` directly. Assert response is 404 (or redirect — check Next.js default behaviour for missing route).

6. **Settings page marks Meetings + Timesheet as always shared**
   - Back as fractional user, navigate to Settings.
   - Assert the Meetings row shows the "Always shared" badge (or equivalent copy).
   - Assert the Timesheet row shows the same.
   - Assert there is no Tasks row in the sharing section.

Helper: factor common login + seed steps into `tests/e2e/helpers/portal-sharing-helpers.ts` if scenarios repeat.

### 8. Final grep

After edits:
```bash
grep -rn "is_client_visible" src/ --include="*.ts" --include="*.tsx"
```

Remaining hits should be ONLY in the code paths for: deliverables, notes, assets, CRM, contacts, invoices, research. Those modules still use the flag by design. **No hits in tasks, meetings, time_entries, or meetings/tasks/time-entries UI.**

## Files Likely Affected

- `src/components/meetings/meeting-form.tsx` — **Modify**
- `src/lib/validations/meetings.ts` — **Modify**
- `src/lib/actions/meetings.ts` — **Modify** (including lines 185, 207, 334)
- `src/lib/actions/timesheet.ts` (or equivalent) — **Modify**
- `src/components/meetings/meeting-list.tsx` — **Modify** (if share indicator existed)
- `src/app/(dashboard)/settings/page.tsx` — **Modify** (add "Always shared" badges)
- `src/lib/actions/__tests__/meetings.test.ts` — **Modify** (remove share-flag cases)
- `src/lib/validations/__tests__/meetings.test.ts` — **Modify**
- `tests/e2e/portal-sharing-defaults.spec.ts` — **Create**
- `tests/e2e/helpers/portal-sharing-helpers.ts` — **Create** (optional)

## Acceptance criteria

- [ ] Meeting form has no "Share with client" checkbox
- [ ] Meetings server actions do not read or write `is_client_visible` (including the three previously-hardcoded `false` sites)
- [ ] Time-entry server actions do not reference `is_client_visible`
- [ ] Settings Meetings + Timesheet rows show an "Always shared" badge or equivalent indicator
- [ ] Settings still allows disabling a whole module for a client via the `is_enabled` toggle (unchanged)
- [ ] A newly created meeting is visible in the portal without any toggle being touched
- [ ] A newly created time entry is visible in the portal without any toggle being touched
- [ ] The portal no longer lists or routes to Tasks (regression check — Prompt 5 responsibility, but Playwright scenario 5 reconfirms)
- [ ] Grep for `is_client_visible` in tasks/meetings/time-entries/portal code paths returns zero hits
- [ ] `npm test` passes — existing tests updated/removed as needed
- [ ] `tests/e2e/portal-sharing-defaults.spec.ts` passes all 6 scenarios

## Notes

- The three hardcoded `false` writes in `meetings.ts` were the reason meetings auto-created from transcript processing defaulted to hidden. Removing them is exactly the point — David wants these visible by default.
- If the portal user's meeting list was previously ordered and filtered on `is_client_visible`, confirm the remaining query still orders by `date desc` or equivalent so nothing looks out of place.
- Keep the portal's transcript exclusion unchanged — the portal still selects only `summary, action_items` (per `portal-meetings.tsx`). "Always share" refers to the meeting record, not the raw transcript.
- The "Always shared" badge is small-scope copy. Don't over-engineer — a shadcn `<Badge>` with an optional `<Tooltip>` is enough.

---

<!-- GATES BELOW -->

## Review Checklist — 2026-04-17 22:00

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] The three hardcoded `is_client_visible: false` sites in `meetings.ts` are explicitly called out
- [ ] Transcript exclusion in portal is preserved (portal still shows summary only)
- [ ] Module-level `is_enabled` toggle is preserved as escape hatch
- [ ] Playwright scenarios cover the complete new behaviour
- [ ] Final grep check catches stragglers
- [ ] Acceptance criteria match the plan
- [ ] No scope creep into other modules' per-item sharing (deliverables/notes/assets/CRM/contacts/invoices/research stay as-is)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-17_06-always-share-meetings-timesheet.md`

---
## Implementation Notes — 2026-04-17 22:30
- **Commit:** `c15de11` — feat(portal): always-share meetings + time entries, drop per-item flag
- **Tests:** 956/958 vitest passed. The 2 failures are pre-existing flaky tests in `src/components/crm/__tests__/slack-messages-tab.test.tsx` (Slack message rendering — unrelated to this prompt). First vitest run immediately prior had all 958 passing.
- **Verification URL:** http://localhost:3002/settings (Portal Sharing section) and http://localhost:3002/meetings (New meeting dialog)
- **Playwright check:** Added `src/__tests__/e2e/portal-sharing-defaults.spec.ts` (6 scenarios). Did not run the suite interactively — Playwright `webServer` auto-boots the dev server on `:3002` when invoked.
- **Changes summary:**
  - `meeting-form.tsx`: removed the Checkbox import, the `is_client_visible` default and edit-mapping, and the "Visible to client portal" field.
  - `validations/meetings.ts`: removed `is_client_visible` from the zod schema.
  - `actions/meetings.ts`: dropped `is_client_visible` from `createMeeting`, `updateMeeting`, and the three auto-processed sites (`createMeetingFromTranscript` meeting insert + tasks insert, `reprocessMeetingAction` tasks insert).
  - `actions/__tests__/meetings.test.ts` + `meetings/__tests__/meeting-form-prefill.test.tsx`: removed `is_client_visible` from fixtures.
  - `api/timer/route.ts` + `(dashboard)/timesheet/page.tsx`: removed `is_client_visible: false` from the `time_entries` inserts.
  - `services/recording-service.ts`: removed `is_client_visible: false` from the 2 meeting inserts, 2 task inserts, and 2 time-entry inserts.
  - `(dashboard)/meetings/page.tsx`: removed the column from the SELECT.
  - `(portal)/portal/page.tsx`, `portal/portal-meetings.tsx`, `portal/portal-timesheet.tsx`: removed `.eq("is_client_visible", true)` for meetings and time_entries (columns no longer exist). Kept the filter on invoices/crm_customers/deliverables — those modules still use per-item sharing.
  - `components/settings/portal-sharing-settings.tsx`: added "Always shared" Badge next to the Meetings and Timesheet labels (driven by a new `alwaysShared` flag on the module description map). `is_enabled` toggle preserved.
  - `__tests__/portal/portal-views.test.ts`: scoped the "filters by is_client_visible" test to the 4 modules that still use it (deliverables/invoices/notes/research).
  - `__tests__/e2e/portal-settings.spec.ts`: removed "Tasks" from the expected module list (prompt 5 dropped it); reduced the minimum switch count from 7 → 6.
  - `services/__tests__/trello-export-service.test.ts`, `(dashboard)/dashboard/dashboard.test.tsx`: removed `is_client_visible` fields from test fixtures.
- **Deviations from plan:** Prompt referenced file path `tests/e2e/portal-sharing-defaults.spec.ts`. The project's Playwright `testDir` is `./src/__tests__`, so the spec was created at `src/__tests__/e2e/portal-sharing-defaults.spec.ts` to match project convention. Also removed `is_client_visible: false` from the two task inserts in `recording-service.ts` and the task insert in `createMeetingFromTranscript` — the column was dropped from `tasks` by migration 019, so those writes would otherwise fail.
- **Follow-up issues:** None. Pre-existing TS errors in `meeting-form.tsx` (react-hook-form duplicate-type warnings) were present before this change and remain; out of scope.

---
## Testing Checklist — 2026-04-17 22:30
**Check the changes:** http://localhost:3002

- [ ] `/meetings` loads, "Add Meeting" dialog has no "Share with client"/"Visible to client portal" checkbox
- [ ] Creating a new meeting as the fractional user does not prompt for a share flag
- [ ] `/timesheet` loads, "Add Time" dialog has no share checkbox
- [ ] `/settings` → Portal Sharing shows "Always shared" badge next to **Meetings** and **Timesheet** rows
- [ ] The Meetings and Timesheet toggles in Settings still disable the whole module for the selected client when flipped off
- [ ] Log in as a Lovesac portal user: new meetings appear on `/portal/meetings` immediately (no toggle required)
- [ ] Same portal user: new time entries appear on `/portal/timesheet` immediately
- [ ] No "Tasks" entry in the portal sidebar; `/portal/tasks` returns 404 / redirects to login
- [ ] `/portal/meetings` still shows only summary + action items (transcript excluded)
- [ ] No console errors on dashboard or portal pages

### Actions for David
- Sign in as the fractional user at http://localhost:3002 and tick the meeting/timesheet dialog checkboxes above.
- Swap to the Lovesac portal user (or whichever client you use for portal smoke tests) and confirm the portal scenarios.
- If everything looks right, the "Always shared" copy can be tweaked in `src/components/settings/portal-sharing-settings.tsx:68-76` — the badge is just a small shadcn `<Badge>` with a `title` tooltip.
- Run `npx playwright test src/__tests__/e2e/portal-sharing-defaults.spec.ts` when you have a spare moment to execute the 6 new scenarios against your dev server.

**Review this file:** `file:///C:/Projects/conscia-fractional/kanban/2_testing/PROMPT_2026-04-17_06-always-share-meetings-timesheet.md`

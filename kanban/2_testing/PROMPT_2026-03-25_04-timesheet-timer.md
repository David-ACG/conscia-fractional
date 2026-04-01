# Task: Timesheet & Timer Widget

**Date:** 2026-03-25
**Plan Reference:** PLAN_2026-03-25_fractionalbuddy-foundation.md

## What to change

Build the timesheet module and timer widget — the most important day-1 feature. Includes: fixed-position timer widget in the app corner, pop-out `/timer` route, category autocomplete (learned from history), timesheet daily/weekly view, and manual time entry.

## Specific Instructions

### 1. Timer Widget (`src/components/timer/`)

**TimerProvider** (`src/components/timer/timer-provider.tsx`):

- React context wrapping the dashboard layout
- Manages timer state: running/stopped, category, startedAt
- Fetches active timer from `active_timer` table on mount
- BroadcastChannel('timer-sync') for cross-tab sync
- Exposes: `startTimer(category)`, `stopTimer()`, `isRunning`, `currentCategory`, `startedAt`, `elapsedSeconds`

**TimerDisplay** (`src/components/timer/timer-display.tsx`):

- Shared component used by both widget and pop-out
- Shows `hh:mm:ss` computed from `Date.now() - startedAt`
- Uses `requestAnimationFrame` for smooth updates (not setInterval)
- Only updates DOM when displayed second changes
- Green dot indicator when running

**TimerWidget** (`src/components/timer/timer-widget.tsx`):

- `position: fixed`, bottom-right corner
- Collapsed: 280px x 64px — timer, category pill, start/stop button
- Expanded: 280px x ~200px (when category selector open)
- Start/stop button: green circle (start) → red square (stop)
- Category pill: tappable to change
- Secondary text: "Today: Xh Ym" total
- Subtle border, shadow-lg, bg-card, rounded-xl
- Draggable? No — fixed position is simpler

**CategorySelector** (`src/components/timer/category-selector.tsx`):

- Combo box (shadcn Command component)
- Fetches categories from API: `GET /api/timer/categories`
- Ranked by hybrid score: recency (40%) + frequency (30%) + time-of-day (30%)
- Fuzzy search via `fuse.js` as user types
- If no match, typed text becomes new category on submit
- Shows color dot per category (auto-assigned from hash)
- Most likely category pre-selected when starting

**Install fuse.js:**

```bash
npm install fuse.js
```

### 2. Pop-out Timer Route (`src/app/timer/`)

`src/app/timer/layout.tsx`:

- Minimal layout: no sidebar, no header, no navigation
- Just the timer content + theme provider
- Designed for a 320x140px window

`src/app/timer/page.tsx`:

- Same TimerDisplay + CategorySelector + start/stop
- "Today: Xh Ym" total
- Syncs with main app via BroadcastChannel

### 3. Timer API Routes

`src/app/api/timer/route.ts`:

- `GET` — return current active timer (if any)
- `POST` — start timer: insert into `active_timer`, body: `{ category, client_id }`
- `PATCH` — stop timer: delete from `active_timer`, insert into `time_entries`

`src/app/api/timer/categories/route.ts`:

- `GET` — return ranked categories for autocomplete
- Query: `SELECT category, COUNT(*), MAX(started_at), AVG(EXTRACT(HOUR FROM started_at)) FROM time_entries WHERE user_id = ? GROUP BY category`
- Apply hybrid ranking: recency (40%) + frequency (30%) + time-of-day (30%)

### 4. Timesheet Page (`src/app/(dashboard)/timesheet/page.tsx`)

**Daily/Weekly view:**

- Tab bar: "Daily" | "Weekly" (default: Daily)
- Date navigator: < Today > arrows
- List of time entries for selected date/week
- Each entry: category pill, description, start-end time, duration
- Edit button (inline edit) and delete button
- Total hours at bottom

**Manual entry form:**

- "Add Time" button opens a dialog
- Fields: date, start time, end time (or duration), category (same autocomplete), description, billable toggle
- Saves to `time_entries` with `is_manual = true`

**Weekly summary:**

- Bar chart or simple table showing hours per day
- Category breakdown for the week
- Total vs contract limit (16h)

### 5. Idle Detection

In TimerProvider:

- Track mouse/keyboard events (`mousemove`, `keydown`, `click`, `scroll`)
- After 15 minutes of inactivity while timer is running:
  - Show toast notification (sonner): "You've been idle for X minutes"
  - Actions: "Discard idle time" | "Keep it" | "Split entry"
- After 2+ hours of continuous timer: subtle warning toast

### 6. Keyboard Shortcuts

In TimerProvider:

- `Alt+T` — toggle timer (start with last category / stop)
- When category selector is open: standard keyboard nav (up/down, enter to select, esc to close)

### 7. Tests

`src/components/timer/timer-widget.test.tsx`:

- Timer renders in stopped state
- Start button starts timer
- Category selector opens on click
- Fuzzy search filters categories

`src/app/(dashboard)/timesheet/timesheet.test.tsx`:

- Timesheet page renders
- Daily view shows entries
- Manual entry form opens
- Tab switching works

`src/app/api/timer/route.test.ts`:

- GET returns null when no active timer
- POST creates active timer
- PATCH stops timer and creates time entry

## Files likely affected

- `src/components/timer/timer-provider.tsx`
- `src/components/timer/timer-display.tsx`
- `src/components/timer/timer-widget.tsx`
- `src/components/timer/category-selector.tsx`
- `src/app/timer/layout.tsx`
- `src/app/timer/page.tsx`
- `src/app/api/timer/route.ts`
- `src/app/api/timer/categories/route.ts`
- `src/app/(dashboard)/timesheet/page.tsx`
- `src/components/timesheet/time-entry-list.tsx`
- `src/components/timesheet/manual-entry-form.tsx`
- `src/components/timesheet/weekly-summary.tsx`
- `src/app/(dashboard)/layout.tsx` (add TimerProvider + TimerWidget)
- `package.json` (add fuse.js)

## Acceptance criteria

- [ ] Timer widget visible in bottom-right corner of all dashboard pages
- [ ] One-click start with most likely category pre-selected
- [ ] Running timer shows hh:mm:ss updating in real-time
- [ ] Category dropdown shows previous entries ranked by hybrid score
- [ ] Fuzzy search filters categories as user types
- [ ] New category created when typing unmatched text
- [ ] Pop-out `/timer` opens in small window (320x140px)
- [ ] BroadcastChannel syncs timer state between main app and pop-out
- [ ] Timer survives page refresh (reads active_timer from DB)
- [ ] Stopping timer creates a time_entry record
- [ ] Idle detection prompts after 15 minutes
- [ ] Timesheet daily view shows today's entries
- [ ] Manual time entry form works (date, start, end, category, description)
- [ ] Weekly view shows hours per day and total vs 16h limit
- [ ] Alt+T keyboard shortcut toggles timer
- [ ] `npm test` passes

## Notes

- Research doc Section 11 has full timer widget UX patterns
- Use `requestAnimationFrame` not `setInterval` for timer display
- Server-side timer state (active_timer table) is source of truth
- Category auto-assign colors: hash category name → pick from 12-color palette
- The timer widget should not interfere with other UI elements

---

<!-- GATES BELOW — Filled in by Claude at each stage. Do not edit manually. -->

## Review Checklist — 2026-03-25 17:30

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] Timer UX matches research doc Section 11
- [ ] BroadcastChannel sync described correctly
- [ ] Category ranking algorithm specified

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-25_04-timesheet-timer.md`

## Implementation Notes

<!-- Appended by Claude with timestamp (Gate 3) -->

## Testing Checklist

<!-- Appended by Claude with timestamp (Gate 4) -->

### Actions for David

<!-- ALWAYS include this section. State what David needs to do, or explicitly say "No actions required." -->

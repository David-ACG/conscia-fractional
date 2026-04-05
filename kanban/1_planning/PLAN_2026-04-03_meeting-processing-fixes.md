# Meeting Processing Fixes — Date Extraction, Tasks, Summary Format

_3 April 2026_

---

## Issues Identified

1. **Meeting dates are wrong** — Uploaded recordings use the upload timestamp instead of the actual meeting date/time. The real date/time is encoded in the filename (e.g., "Conscia - 1 Apr at 17-06" = 1 April 2026 at 17:06).
2. **Re-processing doesn't create tasks** — `reprocessMeetingAction` updates title/summary but doesn't create tasks from Claude's extracted action_items.
3. **Summary format** — Summary is stored as markdown but downloads as plain .txt. Should render as formatted MD in the detail view and offer PDF download.
4. **Timesheet dates wrong** — Derived from wrong meeting dates (issue #1 causes this).

## Fix 1: Extract Meeting Date from Filename (HIGH)

### Problem

`processUploadedRecording()` in `recording-service.ts` sets `meeting_date: new Date().toISOString()` — the upload time, not the actual meeting time.

### Solution

Parse the filename to extract date/time. Filename patterns from David's files:

- `Conscia - 1 Apr at 17-06.m4a` → 1 April 2026 at 17:06
- `Conscia - Laurel - 1 Apr at 17-40.m4a` → 1 April 2026 at 17:40
- `Conscia - lovesac - 27 Mar at 15-31.m4a` → 27 March 2026 at 15:31
- `Conscia 30 Mar at 16-32.m4a` → 30 March 2026 at 16:32

Pattern: `(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+at\s+(\d{1,2})-(\d{2})`

### Files to Modify

- `src/lib/services/recording-service.ts` — Add `parseMeetingDateFromFilename(filename)` function, use result as `meeting_date` (fall back to `new Date()` if parsing fails)
- `src/lib/services/__tests__/recording-service.test.ts` — Test date parsing with all 4 filename patterns + edge cases

### Acceptance Criteria

- [ ] "Conscia - 1 Apr at 17-06.m4a" → meeting_date = 2026-04-01T17:06:00
- [ ] "Conscia 30 Mar at 16-32.m4a" → meeting_date = 2026-03-30T16:32:00
- [ ] Filenames without date pattern → falls back to current time
- [ ] Timesheet entry uses the parsed meeting date, not upload date
- [ ] Tests pass for all filename patterns

### Data Fix

The 2 existing meetings with wrong dates need updating:

- "Lovesac Data Modeling & Kickoff Planning" (was "Processing: Conscia - 1 Apr at 17-06.m4a") → meeting_date should be 2026-04-01T17:06:00
- "Lovesac Project Alignment - Questions & Data Review" (was "Processing: Conscia - Laurel - 1 Apr at 17-40.m4a") → meeting_date should be 2026-04-01T17:40:00
- The timesheet entries for these also need their started_at/stopped_at corrected

---

## Fix 2: Re-process Creates Tasks (HIGH)

### Problem

`reprocessMeetingAction` in `src/lib/actions/meetings.ts` calls `extractMeetingData()` but only updates title and summary — it discards the extracted tasks.

### Solution

After extraction, create tasks from `extracted.tasks` using the existing `createTask` action or direct DB insert.

### Files to Modify

- `src/lib/actions/meetings.ts` — Update `reprocessMeetingAction` to create tasks from `extracted.tasks`
- `src/lib/services/recording-service.ts` — Check if `processUploadedRecording` already creates tasks (it should, via the same extraction flow)

### Acceptance Criteria

- [ ] Re-processing a meeting creates tasks with title, description, priority, assignee
- [ ] Tasks linked to the meeting via meeting_id
- [ ] Duplicate tasks not created if re-processing again (clear existing meeting tasks first, or skip if tasks exist)
- [ ] Tests pass

---

## Fix 3: Summary as Formatted Markdown + PDF Download (MEDIUM)

### Problem

Summary is markdown text but renders as plain text in the detail view and downloads as .txt.

### Solution

1. Render summary with a markdown renderer in the meeting detail view
2. Change "Download Summary (.txt)" to "Download Summary (.md)"
3. Add "Download Summary (.pdf)" that converts markdown to PDF client-side

### Files to Modify

- `src/components/meetings/meeting-detail.tsx` — Render summary with `react-markdown` (install package)
- `src/components/meetings/meeting-list.tsx` — Change download extension from .txt to .md, add PDF download option
- Install `react-markdown` and optionally `html2pdf.js` or `jspdf` for PDF generation

### Acceptance Criteria

- [ ] Summary renders with formatted headings, bullets, bold in detail view
- [ ] "Download Summary (.md)" downloads valid markdown file
- [ ] "Download Summary (.pdf)" downloads a formatted PDF
- [ ] Tests pass

---

## Fix 4: Correct Existing Data (ONE-TIME)

### Problem

2 meetings and their timesheet entries have wrong dates.

### Solution

SQL migration or one-time script to fix:

- Meeting "Processing: Conscia - 1 Apr at 17-06.m4a" → meeting_date = 2026-04-01T17:06:00
- Meeting "Processing: Conscia - Laurel - 1 Apr at 17-40.m4a" → meeting_date = 2026-04-01T17:40:00
- Associated timesheet entries: update started_at/stopped_at to match

---

## Prompt Breakdown

| #   | Prompt                                    | Fixes         | Priority |
| --- | ----------------------------------------- | ------------- | -------- |
| 1   | Date extraction from filename + data fix  | Fix 1 + Fix 4 | HIGH     |
| 2   | Re-process creates tasks                  | Fix 2         | HIGH     |
| 3   | Markdown summary rendering + PDF download | Fix 3         | MEDIUM   |

---

## Review Checklist — 2026-04-03 23:15

- [ ] Scope is correctly bounded
- [ ] Technical approach matches the project's stack
- [ ] Acceptance criteria are specific and testable
- [ ] No unexpected dependencies introduced
- [ ] Fixes address all issues David raised

**Review this plan:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PLAN_2026-04-03_meeting-processing-fixes.md`

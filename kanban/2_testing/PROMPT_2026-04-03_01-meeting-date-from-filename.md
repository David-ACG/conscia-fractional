# Task: Extract Meeting Date/Time from Filename + Fix Existing Data

**Date:** 2026-04-03
**Plan Reference:** PLAN_2026-04-03_meeting-processing-fixes.md

## What to change

Meeting recordings are uploaded with filenames that contain the actual meeting date/time (e.g., "Conscia - 1 Apr at 17-06.m4a"), but the system currently uses `new Date()` (upload time) as the meeting_date. This causes wrong dates on meetings and their associated timesheet entries. We need to parse the date from the filename, use it as the meeting_date, and fix the 2 existing meetings that already have wrong dates.

## Specific Instructions

### 1. Create filename date parser

Create `src/lib/services/filename-date-parser.ts` with:

```typescript
export function parseMeetingDateFromFilename(filename: string): Date | null;
```

- Parse filenames matching this regex: `(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+at\s+(\d{1,2})-(\d{2})`
- Known filename patterns:
  - "Conscia - 1 Apr at 17-06.m4a" -> 1 April 2026 at 17:06
  - "Conscia - Laurel - 1 Apr at 17-40.m4a" -> 1 April 2026 at 17:40
  - "Conscia - lovesac - 27 Mar at 15-31.m4a" -> 27 March 2026 at 15:31
  - "Conscia 30 Mar at 16-32.m4a" -> 30 March 2026 at 16:32
- Year logic: if the parsed month is in the future relative to the current date, use previous year. Otherwise use current year. This handles December recordings viewed in January.
- Return `null` if no match found.

### 2. Update recording-service.ts

In `src/lib/services/recording-service.ts`, in the `processUploadedRecording` function:

- Import and call `parseMeetingDateFromFilename(fileName)` to get the parsed date
- Use the parsed date for `meeting_date` instead of `new Date()`. Fall back to `new Date()` if parsing returns null.
- Also update the auto-created timesheet entry: use the parsed date for `started_at` and calculate `stopped_at` as `started_at + actual_duration_seconds`.

### 3. Create data fix migration

Create `supabase/migrations/015_fix_meeting_dates.sql`:

```sql
-- Fix meeting dates for recordings uploaded on 2026-04-01
-- These had upload timestamps instead of actual meeting times

-- Fix "Conscia - 1 Apr at 17-06" meeting
UPDATE meetings
SET meeting_date = '2026-04-01T17:06:00+01:00',
    updated_at = now()
WHERE original_filename LIKE '%1 Apr at 17-06%'
   OR title LIKE '%Conscia - 1 Apr at 17-06%';

-- Fix associated time entries
UPDATE time_entries
SET started_at = '2026-04-01T17:06:00+01:00',
    stopped_at = '2026-04-01T17:06:00+01:00'::timestamptz + (
      SELECT (actual_duration_seconds || ' seconds')::interval
      FROM meetings m
      WHERE m.id = time_entries.meeting_id
    ),
    updated_at = now()
WHERE meeting_id IN (
  SELECT id FROM meetings
  WHERE original_filename LIKE '%1 Apr at 17-06%'
     OR title LIKE '%Conscia - 1 Apr at 17-06%'
);

-- Fix "Conscia - Laurel - 1 Apr at 17-40" meeting
UPDATE meetings
SET meeting_date = '2026-04-01T17:40:00+01:00',
    updated_at = now()
WHERE original_filename LIKE '%1 Apr at 17-40%'
   OR (title LIKE '%Laurel%' AND title LIKE '%1 Apr at 17-40%');

-- Fix associated time entries
UPDATE time_entries
SET started_at = '2026-04-01T17:40:00+01:00',
    stopped_at = '2026-04-01T17:40:00+01:00'::timestamptz + (
      SELECT (actual_duration_seconds || ' seconds')::interval
      FROM meetings m
      WHERE m.id = time_entries.meeting_id
    ),
    updated_at = now()
WHERE meeting_id IN (
  SELECT id FROM meetings
  WHERE original_filename LIKE '%1 Apr at 17-40%'
     OR (title LIKE '%Laurel%' AND title LIKE '%1 Apr at 17-40%')
);
```

Adjust the SQL if the column names differ from what is expected -- check the actual schema first.

### 4. Write Vitest tests

Create `src/lib/services/__tests__/filename-date-parser.test.ts`:

- Test all 4 filename patterns listed above produce correct Date objects
- Test filename with no date pattern (e.g., "random-audio.m4a") returns null
- Test different file extensions (.mp3, .wav, .m4a)
- Test month rollover: a "Dec" filename parsed in January should use previous year
- Test edge case: filename with partial match (e.g., "Meeting at 5-30.m4a" with no month) returns null

## Files likely affected

- `src/lib/services/filename-date-parser.ts` (new)
- `src/lib/services/__tests__/filename-date-parser.test.ts` (new)
- `src/lib/services/recording-service.ts` (modify)
- `supabase/migrations/015_fix_meeting_dates.sql` (new)

## Acceptance criteria

- [ ] "Conscia - 1 Apr at 17-06.m4a" parses to 1 April 2026 at 17:06
- [ ] "Conscia 30 Mar at 16-32.m4a" parses to 30 March 2026 at 16:32
- [ ] Filenames without a date pattern fall back to `new Date()`
- [ ] Timesheet entries use the parsed meeting date for started_at, not upload date
- [ ] Existing 2 meetings have corrected meeting_date values after migration
- [ ] Associated time_entries have corrected started_at/stopped_at after migration
- [ ] All Vitest tests pass

## Notes

- The timezone for parsed dates should be UK time (+01:00 BST or +00:00 GMT depending on DST). For simplicity, assume the system timezone is correct and create dates in local time.
- The migration uses `+01:00` because April 2026 is in BST.
- Check `original_filename` column exists on the meetings table before relying on it in the migration. Fall back to title matching if needed.

---

## Review Checklist — 2026-04-03 23:30

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-03_01-meeting-date-from-filename.md`

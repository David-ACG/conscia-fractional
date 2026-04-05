-- Fix meeting dates for recordings uploaded on 2026-04-01
-- These had upload timestamps instead of actual meeting times from filenames

-- Fix "Conscia - 1 Apr at 17-06" meeting
UPDATE meetings
SET meeting_date = '2026-04-01T17:06:00+01:00',
    updated_at = now()
WHERE original_filename LIKE '%1 Apr at 17-06%'
   OR title LIKE '%1 Apr at 17-06%';

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
     OR title LIKE '%1 Apr at 17-06%'
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

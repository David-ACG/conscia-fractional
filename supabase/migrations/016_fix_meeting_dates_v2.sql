-- Fix meeting dates based on filenames in recording_url
-- Conscia - 1 Apr at 17-06.m4a (BST = UTC+1)
UPDATE public.meetings
SET meeting_date = '2026-04-01T16:06:00+00:00',
    original_filename = 'Conscia - 1 Apr at 17-06.m4a'
WHERE id = 'a0a6c874-1ef5-40fc-bb45-15cd6056dd44';

-- Conscia - Laurel - 1 Apr at 17-40.m4a (BST = UTC+1)
UPDATE public.meetings
SET meeting_date = '2026-04-01T16:40:00+00:00',
    original_filename = 'Conscia - Laurel -  1 Apr at 17-40.m4a'
WHERE id = 'f496d966-e7b6-4b2e-971f-699757ebc324';

-- Conscia 30 Mar at 16-32.m4a (BST = UTC+1)
UPDATE public.meetings
SET meeting_date = '2026-03-30T15:32:00+00:00',
    original_filename = 'Conscia 30 Mar at 16-32.m4a'
WHERE id = 'dae3f3f9-9ea7-4fd3-a151-18ae5cf7d571';

-- Fix associated time_entries
UPDATE public.time_entries
SET started_at = '2026-04-01T16:06:00+00:00',
    stopped_at = '2026-04-01T16:06:00+00:00'::timestamptz + (duration_minutes * interval '1 minute')
WHERE meeting_id = 'a0a6c874-1ef5-40fc-bb45-15cd6056dd44';

UPDATE public.time_entries
SET started_at = '2026-04-01T16:40:00+00:00',
    stopped_at = '2026-04-01T16:40:00+00:00'::timestamptz + (duration_minutes * interval '1 minute')
WHERE meeting_id = 'f496d966-e7b6-4b2e-971f-699757ebc324';

UPDATE public.time_entries
SET started_at = '2026-03-30T15:32:00+00:00',
    stopped_at = '2026-03-30T15:32:00+00:00'::timestamptz + (duration_minutes * interval '1 minute')
WHERE meeting_id = 'dae3f3f9-9ea7-4fd3-a151-18ae5cf7d571';

# Task: Re-process Meeting Creates Tasks from Extracted Action Items

**Date:** 2026-04-03
**Plan Reference:** PLAN_2026-04-03_meeting-processing-fixes.md

## What to change

When a meeting is re-processed via `reprocessMeetingAction`, Claude extracts action items/tasks from the transcript, but they are discarded -- only the title and summary are saved. The extracted tasks need to be persisted to the `tasks` table and linked to the meeting. The same logic should also apply during initial recording processing in `processUploadedRecording`.

## Specific Instructions

### 1. Read the current extraction output shape

Read `src/lib/services/transcript-extraction-service.ts` to understand what `extractMeetingData()` returns. The extracted object likely has a `tasks` array with objects containing `title`, `description`, `priority`, `assignee`, etc. Document the exact shape before modifying anything.

### 2. Update reprocessMeetingAction

In `src/lib/actions/meetings.ts`, find `reprocessMeetingAction` and modify it:

- After the extraction call succeeds:
  1. Delete existing tasks for this meeting to prevent duplicates on re-process:
     ```typescript
     await adminClient.from("tasks").delete().eq("meeting_id", meetingId);
     ```
  2. If `extracted.tasks` (or equivalent field) is a non-empty array, insert new tasks:
     ```typescript
     const tasksToInsert = extracted.tasks.map((task) => ({
       title: task.title,
       description: task.description || null,
       priority: task.priority || "medium", // map to 'high' | 'medium' | 'low'
       status: "todo",
       meeting_id: meetingId,
       client_id: meeting.client_id, // get from the meeting record
       assignee: task.assignee || null,
     }));
     await adminClient.from("tasks").insert(tasksToInsert);
     ```
  3. Update the meeting's `action_items` jsonb field with the extracted tasks:
     ```typescript
     await adminClient
       .from("meetings")
       .update({
         action_items: extracted.tasks,
       })
       .eq("id", meetingId);
     ```

- Use `createAdminClient()` for all database operations (consistent with project pattern -- bypasses RLS).
- Do NOT import `createTask` from `src/lib/actions/tasks.ts` to avoid circular imports. Use direct Supabase insert instead.

### 3. Check processUploadedRecording

In `src/lib/services/recording-service.ts`, check if `processUploadedRecording` creates tasks after Claude extraction. If it does not:

- Add the same task creation logic after the extraction step (delete existing + insert new)
- Also update the meeting's `action_items` field

If it already creates tasks, verify the logic matches the pattern above (delete-then-insert to handle re-uploads).

### 4. Write Vitest tests

Create or update test files as appropriate:

- **Test reprocessMeetingAction creates tasks:** Mock `extractMeetingData` to return a result with tasks. Verify tasks are inserted into the `tasks` table with correct fields (title, description, priority, status, meeting_id, client_id, assignee).
- **Test duplicate prevention:** Call reprocess twice. Verify the second call deletes old tasks before creating new ones (no duplicates -- task count should match extraction output, not double).
- **Test tasks linked via meeting_id:** Verify each inserted task has the correct `meeting_id`.
- **Test action_items updated:** Verify the meeting record's `action_items` jsonb field is updated with the extracted tasks.
- **Test empty tasks array:** If extraction returns no tasks, verify no insert is attempted and no error is thrown.

## Files likely affected

- `src/lib/actions/meetings.ts` (modify -- reprocessMeetingAction)
- `src/lib/services/recording-service.ts` (modify -- processUploadedRecording, if needed)
- `src/lib/actions/__tests__/meetings.test.ts` (new or modify)
- `src/lib/types.ts` (check -- may need to verify task type shape)

## Acceptance criteria

- [ ] Re-processing a meeting creates tasks from extracted action_items
- [ ] Each task has: title, description, priority, status ("todo"), meeting_id, client_id, assignee
- [ ] Tasks are linked to the meeting via meeting_id
- [ ] Duplicate tasks are cleared on re-process (delete existing before insert)
- [ ] Meeting's `action_items` jsonb field is updated with extracted tasks
- [ ] `processUploadedRecording` also creates tasks after extraction
- [ ] Empty tasks array does not cause errors
- [ ] All Vitest tests pass

## Notes

- Check the exact shape of what `extractMeetingData()` returns by reading `src/lib/services/transcript-extraction-service.ts`. The field might be `tasks`, `action_items`, or `actionItems` -- use whatever the actual field name is.
- The `tasks` table schema has: id, client_id, title, description, priority, status, assignee, meeting_id, and standard timestamps. Verify column names match before inserting.
- All server actions in this project use `createAdminClient()` from `src/lib/supabase/admin.ts` which bypasses RLS.

---

## Review Checklist — 2026-04-03 23:30

- [ ] Instructions are clear and self-contained
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-04-03_02-reprocess-creates-tasks.md`

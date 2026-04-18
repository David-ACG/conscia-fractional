# Idea: Simplify client-portal sharing

**Date:** 2026-04-17
**Source:** David — interactive session

## The ask

> "At the moment, I seem to have to individually add items to share with the client. This makes things difficult, as I'm never sure whether everything is being shared under a certain tab. I'd like to always share the timesheet and meeting notes. Tasks will be shared through Trello. So there's no need to share tasks."

## Why

Per-item `is_client_visible` toggles create two problems: (1) David has no confidence the client is seeing a complete picture of a tab, and (2) every new meeting or task requires a conscious sharing decision. Shifting to tab-level defaults ("everything in timesheet and meetings is shared, tasks live in Trello") removes that cognitive overhead and eliminates the "did I forget to share that one?" anxiety.

## Desired end state

- **Timesheet:** all time entries always visible in the client portal.
- **Meetings:** all meetings always visible in the client portal (transcript still excluded — portal sees summary + action items only, as today).
- **Tasks:** tab removed from the portal. Client sees tasks in Trello via the export flow (see `PLAN_2026-04-17_trello-task-export.md`).
- Other tabs (deliverables, notes, assets, CRM, contacts, invoices, research) keep their per-item toggle unchanged for now.

## Plan → prompts

- **Plan:** `kanban/1_planning/PLAN_2026-04-17_simplify-portal-sharing.md`
- **Prompts:**
  1. `PROMPT_2026-04-17_04-portal-sharing-db-cleanup.md`
  2. `PROMPT_2026-04-17_05-remove-tasks-from-portal.md`
  3. `PROMPT_2026-04-17_06-always-share-meetings-timesheet.md`

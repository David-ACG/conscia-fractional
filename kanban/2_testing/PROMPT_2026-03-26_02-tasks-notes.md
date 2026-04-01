# PROMPT 02: Tasks + Notes Modules

## Context

FractionalBuddy is a Next.js 16 app for fractional executives. The Tasks and Notes pages are currently placeholders. Both tables already exist in Supabase with RLS policies. The client switcher from Prompt 01 provides `getActiveClientId()` to filter data by selected client.

**Stack:** Next.js 16.2.1, React 19, TypeScript, Tailwind v4, shadcn/ui (new-york), Supabase, react-hook-form, zod

**Prerequisite:** Prompt 01 (client switcher) must be complete.

## Database Schema (already exists — DO NOT create migrations)

### tasks

```
id uuid PK, client_id uuid FK, crm_customer_id uuid FK nullable,
title text NOT NULL, description text, status text DEFAULT 'todo',
priority text DEFAULT 'medium', assignee text, assignee_type text DEFAULT 'self',
due_date date, meeting_id uuid FK nullable, confidence text nullable,
source_quote text, is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Status values: `todo`, `in_progress`, `blocked`, `done`
Priority values: `low`, `medium`, `high`, `urgent`
Assignee type values: `self`, `client_team`, `external`

### notes

```
id uuid PK, client_id uuid FK, title text NOT NULL, content text,
note_type text DEFAULT 'note', tags jsonb DEFAULT '[]',
is_client_visible boolean DEFAULT false,
created_at timestamptz, updated_at timestamptz
```

Note type values: `note`, `decision`, `context`

## Existing Types (in `src/lib/types.ts` — already defined, DO NOT recreate)

Task and Note interfaces are already defined. Use them as-is.

## What to Build

### 1. Tasks Server Actions (`src/lib/actions/tasks.ts`)

Follow the pattern in `src/lib/actions/contacts.ts`:

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/actions/clients";

// Zod schema for task validation:
// title: string min 1, description: string optional, status: enum, priority: enum,
// assignee: string optional, assignee_type: enum, due_date: string optional (ISO date),
// is_client_visible: boolean

export async function createTask(data: FormData | Record<string, unknown>);
// Parse with zod, get clientId from getActiveClientId()
// Insert into tasks table
// revalidatePath("/tasks")
// Return { success: true } or { error: string }

export async function updateTask(id: string, data: Record<string, unknown>);
// Same pattern, .update().eq("id", id)

export async function deleteTask(id: string);
// .delete().eq("id", id)

export async function updateTaskStatus(id: string, status: string);
// Quick status update for kanban drag (just updates status field)
// revalidatePath("/tasks")
```

### 2. Tasks Page (`src/app/(dashboard)/tasks/page.tsx`)

Replace the placeholder. Async server component:

```typescript
import { createClient } from "@/lib/supabase/server"
import { getActiveClientId } from "@/lib/actions/clients"
import { TaskList } from "@/components/tasks/task-list"
import type { Task } from "@/lib/types"

async function getTasksData() {
  const clientId = await getActiveClientId()
  if (!clientId) return { tasks: [] }

  const supabase = await createClient()
  if (!supabase) return { tasks: [] }

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })

  return { tasks: (data ?? []) as Task[] }
}

export default async function TasksPage() {
  const { tasks } = await getTasksData()
  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold">Tasks</h1>
      <p className="text-muted-foreground">Track work items and action items.</p>
      <div className="mt-6">
        <TaskList tasks={tasks} />
      </div>
    </div>
  )
}
```

### 3. Task List Component (`src/components/tasks/task-list.tsx`)

"use client" component with two views:

**List View (default):**

- Toolbar: Search input + Status filter (All/Todo/In Progress/Blocked/Done) + Priority filter + View toggle (List/Kanban) + "Add Task" button
- Table rows showing: priority badge (color-coded), title, assignee, due date, status badge
- Click row → opens edit form
- Empty state when no tasks

**Kanban View:**

- 4 columns: Todo, In Progress, Blocked, Done
- Each column shows TaskCard components
- Drag-and-drop is OUT OF SCOPE (just click to change status via dropdown on card)
- Column headers show count

State management:

```typescript
const [view, setView] = useState<"list" | "kanban">("list");
const [search, setSearch] = useState("");
const [statusFilter, setStatusFilter] = useState<string>("all");
const [priorityFilter, setPriorityFilter] = useState<string>("all");
const [formOpen, setFormOpen] = useState(false);
const [editingTask, setEditingTask] = useState<Task | null>(null);
```

### 4. Task Card (`src/components/tasks/task-card.tsx`)

Used in kanban view. Shows:

- Priority indicator (colored left border: red=urgent, orange=high, blue=medium, gray=low)
- Title (bold, truncated)
- Assignee name + assignee_type badge
- Due date (red if overdue, amber if within 2 days)
- Click opens edit form

### 5. Task Kanban (`src/components/tasks/task-kanban.tsx`)

Grid layout with 4 columns (responsive: stack on mobile):

```
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
```

Each column:

- Header with status name + count badge
- List of TaskCard components filtered by status
- Empty state text per column

### 6. Task Form (`src/components/tasks/task-form.tsx`)

Dialog form (same pattern as contact-form.tsx):

- Fields: title (required), description (textarea), status (select), priority (select), assignee (text), assignee_type (select: Self/Client Team/External), due_date (date input), is_client_visible (checkbox)
- Create mode: calls createTask
- Edit mode: calls updateTask
- Delete button in edit mode (with confirmation)
- Toast on success/error

### 7. Notes Server Actions (`src/lib/actions/notes.ts`)

Same pattern as tasks:

```typescript
// createNote(data) — title, content, note_type, tags, is_client_visible
// updateNote(id, data)
// deleteNote(id)
// Tags are string[] stored as jsonb
```

### 8. Notes Page (`src/app/(dashboard)/notes/page.tsx`)

Replace placeholder. Server component fetching notes filtered by clientId.

### 9. Note List Component (`src/components/notes/note-list.tsx`)

"use client" component:

- Toolbar: Search input + Type filter (All/Note/Decision/Context as toggle badges) + "Add Note" button
- Type filter badges: clickable pills showing count per type, active state highlighted
  - "Note" badge (default color)
  - "Decision" badge (amber)
  - "Context" badge (blue)
- Grid of NoteCard components (sm:grid-cols-2 lg:grid-cols-3)

### 10. Note Card (`src/components/notes/note-card.tsx`)

Card showing:

- Note type badge (top-right corner, color-coded)
- Title (bold)
- Content preview (first 120 chars, text-muted-foreground)
- Tags as small badges at bottom
- Created date
- Click opens edit form

### 11. Note Form (`src/components/notes/note-form.tsx`)

Dialog form:

- Fields: title (required), content (textarea, 8 rows), note_type (select: Note/Decision/Context), tags (TagInput — reuse from contacts), is_client_visible (checkbox)
- Create/Edit/Delete same pattern as task form
- Toast feedback

## Priority Badge Colors

Use these consistently across the app:

```
urgent: bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400
high: bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400
medium: bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400
low: bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400
```

## Status Badge Colors

```
todo: bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300
in_progress: bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400
blocked: bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400
done: bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400
```

## Acceptance Criteria

- [ ] Tasks page shows list of tasks filtered by selected client
- [ ] Task list view with search, status filter, priority filter
- [ ] Task kanban view with 4 status columns
- [ ] Toggle between list and kanban views
- [ ] Create new task via dialog form
- [ ] Edit existing task (click to open form)
- [ ] Delete task with confirmation
- [ ] Priority badges color-coded
- [ ] Due dates show overdue/upcoming visual indicators
- [ ] Notes page shows list of notes filtered by selected client
- [ ] Note type filter as clickable badges with counts
- [ ] Create/edit/delete notes
- [ ] Tags input works (reuse TagInput component from contacts)
- [ ] Note content previews truncated on cards
- [ ] All forms validate with zod
- [ ] Toast feedback on all CRUD operations
- [ ] Existing tests pass (`npm test`)
- [ ] New tests: tasks.test.ts, notes.test.ts

## Test Expectations

`src/lib/actions/__tests__/tasks.test.ts`:

- Test createTask with valid data
- Test updateTaskStatus changes status
- Test deleteTask removes task

`src/lib/actions/__tests__/notes.test.ts`:

- Test createNote with valid data
- Test updateNote changes content
- Test deleteNote removes note

## Files to Create

- `src/lib/actions/tasks.ts`
- `src/lib/actions/notes.ts`
- `src/lib/actions/__tests__/tasks.test.ts`
- `src/lib/actions/__tests__/notes.test.ts`
- `src/components/tasks/task-list.tsx`
- `src/components/tasks/task-kanban.tsx`
- `src/components/tasks/task-card.tsx`
- `src/components/tasks/task-form.tsx`
- `src/components/notes/note-list.tsx`
- `src/components/notes/note-card.tsx`
- `src/components/notes/note-form.tsx`

## Files to Modify

- `src/app/(dashboard)/tasks/page.tsx` — replace placeholder
- `src/app/(dashboard)/notes/page.tsx` — replace placeholder

---

## Review Checklist — 2026-03-26 19:40

- [ ] Instructions are clear and self-contained (no assumed context)
- [ ] File paths are correct for this project
- [ ] Acceptance criteria match the plan
- [ ] The prompt doesn't introduce scope creep beyond the plan
- [ ] Kanban is view-only (no drag-and-drop complexity)

**Review this prompt:** `file:///C:/Projects/conscia-fractional/kanban/1_planning/PROMPT_2026-03-26_02-tasks-notes.md`

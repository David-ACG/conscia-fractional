"use client";

import * as React from "react";
import {
  Search,
  Plus,
  List,
  LayoutGrid,
  Video,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Merge,
  Loader2,
  Trello,
} from "lucide-react";
import { toast } from "sonner";
import { updateTaskStatus } from "@/lib/actions/tasks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TaskForm } from "./task-form";
import { TaskKanban } from "./task-kanban";
import { TrelloExportDialog } from "./trello-export-dialog";
import type { Task, CrmCustomer } from "@/lib/types";

const priorityConfig: Record<string, { label: string; className: string }> = {
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  high: {
    label: "High",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  },
  medium: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  low: {
    label: "Low",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  todo: {
    label: "Todo",
    className:
      "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  },
  in_progress: {
    label: "In Progress",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  },
  blocked: {
    label: "Blocked",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  done: {
    label: "Done",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  },
};

function getDueDateDisplay(
  dueDateStr: string | null,
): { text: string; className: string } | null {
  if (!dueDateStr) return null;
  const due = new Date(dueDateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  const text = due.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  if (diffDays < 0)
    return { text, className: "text-red-600 dark:text-red-400" };
  if (diffDays <= 2)
    return { text, className: "text-amber-600 dark:text-amber-400" };
  return { text, className: "text-muted-foreground" };
}

type TaskWithMeeting = Task & { meetings?: { title: string } | null };

function TaskRow({
  task,
  onEdit,
}: {
  task: TaskWithMeeting;
  onEdit: (t: Task) => void;
}) {
  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const dueInfo = getDueDateDisplay(task.due_date);
  return (
    <tr
      className="border-b cursor-pointer transition-colors hover:bg-muted/50"
      onClick={() => onEdit(task)}
    >
      <td className="py-2.5 pr-4">
        <Badge variant="secondary" className={priority.className}>
          {priority.label}
        </Badge>
      </td>
      <td className="py-2.5 pr-4 font-medium">
        <div className="flex items-center gap-1.5">
          <button
            title={task.status === "done" ? "Completed" : "Mark as done"}
            className={`shrink-0 rounded-full transition-colors ${
              task.status === "done"
                ? "text-green-600"
                : "text-muted-foreground/40 hover:text-green-600"
            }`}
            onClick={async (e) => {
              e.stopPropagation();
              if (task.status === "done") return;
              await updateTaskStatus(task.id, "done");
              toast.success(`"${task.title}" marked as done`);
            }}
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <span
            className={
              task.status === "done" ? "line-through text-muted-foreground" : ""
            }
          >
            {task.title}
          </span>
          {task.meeting_id && (
            <span
              className="shrink-0 flex items-center gap-0.5 text-xs text-muted-foreground"
              title={task.meetings?.title ?? "From meeting"}
            >
              <Video className="h-3 w-3" />
              {task.meetings?.title ? (
                <span className="max-w-[120px] truncate">
                  {task.meetings.title}
                </span>
              ) : null}
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 pr-4 text-muted-foreground">
        {task.assignee || "—"}
      </td>
      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
        {new Date(task.created_at).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </td>
      <td className="py-2.5">
        <Badge variant="secondary" className={status.className}>
          {status.label}
        </Badge>
      </td>
    </tr>
  );
}

function SortIndicator({
  active,
  dir,
}: {
  active: boolean;
  dir: "asc" | "desc";
}) {
  if (!active) return <span className="ml-1 text-muted-foreground/30">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

function TaskTableHead({
  sortBy,
  sortDir,
  onSort,
}: {
  sortBy?: "priority" | "date" | "assignee" | null;
  sortDir?: "asc" | "desc";
  onSort?: (col: "priority" | "date" | "assignee") => void;
}) {
  const sortable = (col: "priority" | "date" | "assignee", label: string) => (
    <th
      className="pb-2 pr-4 font-medium cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort?.(col)}
    >
      {label}
      <SortIndicator active={sortBy === col} dir={sortDir ?? "asc"} />
    </th>
  );

  return (
    <thead>
      <tr className="border-b text-left text-muted-foreground">
        {sortable("priority", "Priority")}
        <th className="pb-2 pr-4 font-medium">Title</th>
        {sortable("assignee", "Assignee")}
        {sortable("date", "Date Raised")}
        <th className="pb-2 font-medium">Status</th>
      </tr>
    </thead>
  );
}

function TaskTable({
  tasks,
  showDone,
  onToggleDone,
  onEdit,
  sortBy,
  sortDir,
  onSort,
}: {
  tasks: TaskWithMeeting[];
  showDone: boolean;
  onToggleDone: () => void;
  onEdit: (t: Task) => void;
  sortBy: "priority" | "date" | "assignee" | null;
  sortDir: "asc" | "desc";
  onSort: (col: "priority" | "date" | "assignee") => void;
}) {
  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="mt-4 space-y-4">
      {activeTasks.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <TaskTableHead sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
            <tbody>
              {activeTasks.map((task) => (
                <TaskRow key={task.id} task={task} onEdit={onEdit} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {doneTasks.length > 0 && (
        <div>
          <button
            onClick={onToggleDone}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDone ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            Done ({doneTasks.length})
          </button>
          {showDone && (
            <div className="mt-2 overflow-x-auto opacity-70">
              <table className="w-full text-sm">
                <TaskTableHead
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                />
                <tbody>
                  {doneTasks.map((task) => (
                    <TaskRow key={task.id} task={task} onEdit={onEdit} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTasks.length === 0 && doneTasks.length === 0 && (
        <p className="text-center text-muted-foreground mt-8">
          No tasks match your filters.
        </p>
      )}
    </div>
  );
}

interface TaskListProps {
  tasks: TaskWithMeeting[];
  customers?: Pick<CrmCustomer, "id" | "name">[];
  trelloConnected?: boolean;
}

export function TaskList({
  tasks,
  customers = [],
  trelloConnected = false,
}: TaskListProps) {
  const [view, setView] = React.useState<"list" | "kanban">("list");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [showDone, setShowDone] = React.useState(false);
  const [sortBy, setSortBy] = React.useState<
    "priority" | "date" | "assignee" | null
  >(null);
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const [consolidating, setConsolidating] = React.useState(false);
  const [trelloOpen, setTrelloOpen] = React.useState(false);
  const [consolidateGroups, setConsolidateGroups] = React.useState<Array<{
    consolidated_title: string;
    consolidated_description: string;
    priority: string;
    assignee: string | null;
    task_ids: string[];
    reason: string;
    tasks: Array<{ id: string; title: string; meeting: string | null }>;
  }> | null>(null);

  const filtered = React.useMemo(() => {
    let result = tasks;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.assignee && t.assignee.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)),
      );
    }
    if (statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== "all") {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    return result;
  }, [tasks, search, statusFilter, priorityFilter]);

  const sorted = React.useMemo(() => {
    if (!sortBy) return filtered;
    const priorityOrder: Record<string, number> = {
      urgent: 0,
      high: 1,
      medium: 2,
      low: 3,
    };
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        return (
          ((priorityOrder[a.priority] ?? 4) -
            (priorityOrder[b.priority] ?? 4)) *
          dir
        );
      }
      if (sortBy === "date") {
        return (
          (new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()) *
          dir
        );
      }
      if (sortBy === "assignee") {
        const aVal = (a.assignee ?? "").toLowerCase();
        const bVal = (b.assignee ?? "").toLowerCase();
        if (!aVal && !bVal) return 0;
        if (!aVal) return 1;
        if (!bVal) return -1;
        return aVal.localeCompare(bVal) * dir;
      }
      return 0;
    });
  }, [filtered, sortBy, sortDir]);

  function toggleSort(col: "priority" | "date" | "assignee") {
    if (sortBy === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  }

  function handleEdit(task: Task) {
    setEditingTask(task);
    setFormOpen(true);
  }

  function handleCloseForm(open: boolean) {
    setFormOpen(open);
    if (!open) setEditingTask(null);
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="pl-9"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center rounded-md border">
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-r-none"
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "kanban" ? "secondary" : "ghost"}
            size="icon"
            className="h-9 w-9 rounded-l-none"
            onClick={() => setView("kanban")}
            aria-label="Kanban view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>

        <Button
          variant="outline"
          disabled={consolidating}
          onClick={async () => {
            setConsolidating(true);
            toast.loading("Analyzing tasks with Claude...", {
              id: "consolidate",
            });
            try {
              const res = await fetch("/api/tasks/consolidate", {
                method: "POST",
              });
              const data = await res.json();
              toast.dismiss("consolidate");
              if (!res.ok) {
                toast.error(data.error ?? "Consolidation failed");
              } else if (!data.groups?.length) {
                toast.info("No similar tasks found to consolidate");
              } else {
                toast.success(
                  `Found ${data.groups.length} group(s) to consolidate`,
                );
                setConsolidateGroups(data.groups);
              }
            } catch (err) {
              toast.dismiss("consolidate");
              toast.error("Consolidation request failed");
            } finally {
              setConsolidating(false);
            }
          }}
        >
          {consolidating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Merge className="mr-2 h-4 w-4" />
          )}
          {consolidating ? "Analyzing..." : "Consolidate"}
        </Button>

        {trelloConnected ? (
          <Button
            variant="outline"
            onClick={() => setTrelloOpen(true)}
            data-testid="trello-export-button"
          >
            <Trello className="mr-2 h-4 w-4" />
            Export to Trello
          </Button>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} data-testid="trello-export-button-wrapper">
                  <Button
                    variant="outline"
                    disabled
                    data-testid="trello-export-button"
                  >
                    <Trello className="mr-2 h-4 w-4" />
                    Export to Trello
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Connect Trello in Settings</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        <Button
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

      {/* Consolidation suggestions */}
      {consolidateGroups && consolidateGroups.length > 0 && (
        <div className="mt-4 space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Suggested Consolidations</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsolidateGroups(null)}
            >
              Dismiss
            </Button>
          </div>
          {consolidateGroups.map((group, gi) => (
            <div key={gi} className="rounded-md border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">
                  {group.consolidated_title}
                </span>
                <Badge variant="secondary">{group.priority}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{group.reason}</p>
              <div className="text-xs space-y-0.5">
                {group.tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-1 text-muted-foreground"
                  >
                    <span>•</span>
                    <span className="truncate">{t.title}</span>
                    {t.meeting && (
                      <span className="shrink-0 text-primary/70">
                        ({t.meeting})
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={async () => {
                  const res = await fetch("/api/tasks/consolidate", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(group),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`Consolidated ${group.tasks.length} tasks`);
                    setConsolidateGroups(
                      (prev) => prev?.filter((_, i) => i !== gi) ?? null,
                    );
                  } else {
                    toast.error(data.error ?? "Failed");
                  }
                }}
              >
                <Merge className="mr-1 h-3 w-3" />
                Merge {group.tasks.length} tasks
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "No tasks match your filters."
              : "No tasks yet. Create one to get started."}
          </p>
        </div>
      ) : view === "kanban" ? (
        <div className="mt-4">
          <TaskKanban tasks={filtered} onEdit={handleEdit} />
        </div>
      ) : (
        <TaskTable
          tasks={sorted}
          showDone={showDone}
          onToggleDone={() => setShowDone(!showDone)}
          onEdit={handleEdit}
          sortBy={sortBy}
          sortDir={sortDir}
          onSort={toggleSort}
        />
      )}

      {/* Add/Edit dialog */}
      <TaskForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        task={editingTask}
        customers={customers}
      />

      {/* Trello export dialog */}
      <TrelloExportDialog
        tasks={filtered}
        trelloConnected={trelloConnected}
        open={trelloOpen}
        onOpenChange={setTrelloOpen}
      />
    </>
  );
}

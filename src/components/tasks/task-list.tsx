"use client";

import * as React from "react";
import { Search, Plus, List, LayoutGrid, Video } from "lucide-react";
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
import { TaskForm } from "./task-form";
import { TaskKanban } from "./task-kanban";
import type { Task } from "@/lib/types";

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

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  const [view, setView] = React.useState<"list" | "kanban">("list");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [priorityFilter, setPriorityFilter] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);

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
          onClick={() => {
            setEditingTask(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Task
        </Button>
      </div>

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
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Priority</th>
                <th className="pb-2 pr-4 font-medium">Title</th>
                <th className="pb-2 pr-4 font-medium">Assignee</th>
                <th className="pb-2 pr-4 font-medium">Due Date</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const priority = priorityConfig[task.priority];
                const status = statusConfig[task.status];
                const dueInfo = getDueDateDisplay(task.due_date);
                return (
                  <tr
                    key={task.id}
                    className="border-b cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => handleEdit(task)}
                  >
                    <td className="py-2.5 pr-4">
                      <Badge variant="secondary" className={priority.className}>
                        {priority.label}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 font-medium">
                      <div className="flex items-center gap-1.5">
                        {task.title}
                        {task.meeting_id && (
                          <Video
                            className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                            title="From meeting"
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {task.assignee || "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {dueInfo ? (
                        <span className={dueInfo.className}>
                          {dueInfo.text}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Badge variant="secondary" className={status.className}>
                        {status.label}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit dialog */}
      <TaskForm
        open={formOpen}
        onOpenChange={handleCloseForm}
        task={editingTask}
      />
    </>
  );
}

"use client";

import { Badge } from "@/components/ui/badge";
import { TaskCard } from "./task-card";
import type { Task } from "@/lib/types";

const columns: { status: Task["status"]; label: string }[] = [
  { status: "todo", label: "Todo" },
  { status: "in_progress", label: "In Progress" },
  { status: "blocked", label: "Blocked" },
  { status: "done", label: "Done" },
];

const columnHeaderColors: Record<string, string> = {
  todo: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  in_progress:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  blocked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

interface TaskKanbanProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
}

export function TaskKanban({ tasks, onEdit }: TaskKanbanProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map((col) => {
        const columnTasks = tasks.filter((t) => t.status === col.status);
        return (
          <div key={col.status} className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{col.label}</h3>
              <Badge
                variant="secondary"
                className={columnHeaderColors[col.status]}
              >
                {columnTasks.length}
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {columnTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No tasks
                </p>
              ) : (
                columnTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onClick={onEdit} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

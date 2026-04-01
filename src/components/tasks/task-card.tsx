"use client";

import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Task } from "@/lib/types";

const priorityConfig = {
  urgent: {
    label: "Urgent",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    border: "border-l-red-500",
  },
  high: {
    label: "High",
    className:
      "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    border: "border-l-orange-500",
  },
  medium: {
    label: "Medium",
    className:
      "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    border: "border-l-blue-500",
  },
  low: {
    label: "Low",
    className:
      "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
    border: "border-l-gray-500",
  },
};

const assigneeTypeLabels: Record<string, string> = {
  self: "Self",
  client_team: "Client",
  external: "External",
};

function getDueDateInfo(
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

interface TaskCardProps {
  task: Task;
  onClick: (task: Task) => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority];
  const dueInfo = getDueDateInfo(task.due_date);

  return (
    <Card
      className={`cursor-pointer border-l-4 ${priority.border} transition-shadow hover:shadow-md`}
      onClick={() => onClick(task)}
    >
      <CardContent className="p-3">
        <h4 className="truncate font-semibold text-sm">{task.title}</h4>

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {task.assignee && (
            <span className="text-xs text-muted-foreground">
              {task.assignee}
            </span>
          )}
          {task.assignee && (
            <Badge variant="secondary" className="text-xs px-1.5 py-0">
              {assigneeTypeLabels[task.assignee_type] ?? task.assignee_type}
            </Badge>
          )}
        </div>

        {dueInfo && (
          <div
            className={`mt-2 flex items-center gap-1 text-xs ${dueInfo.className}`}
          >
            <Calendar className="h-3 w-3" />
            {dueInfo.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

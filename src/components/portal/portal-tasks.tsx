import { createAdminClient } from "@/lib/supabase/admin";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalEmptyState } from "./portal-empty-state";
import { CheckSquare } from "lucide-react";
import { format, isPast, isValid } from "date-fns";
import { cn } from "@/lib/utils";

interface PortalTasksProps {
  clientId: string;
}

const priorityOrder: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const priorityVariant: Record<
  string,
  "destructive" | "default" | "secondary" | "outline"
> = {
  urgent: "destructive",
  high: "destructive",
  medium: "default",
  low: "secondary",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  todo: "outline",
  in_progress: "default",
  blocked: "secondary",
  done: "secondary",
};

export async function PortalTasks({ clientId }: PortalTasksProps) {
  const admin = createAdminClient();
  if (!admin) return null;

  const { data: tasks } = await admin
    .from("tasks")
    .select("id, title, status, priority, assignee, due_date, created_at")
    .eq("client_id", clientId)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (!tasks || tasks.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <PortalEmptyState
          icon={<CheckSquare className="size-10" />}
          title="No tasks shared yet"
          description="Tasks will appear here once they are shared with you."
        />
      </div>
    );
  }

  const activeTasks = tasks
    .filter((t) => t.status !== "done")
    .sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3),
    );
  const completedTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>

      {activeTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active ({activeTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TaskTable tasks={activeTasks} />
          </CardContent>
        </Card>
      )}

      {completedTasks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed ({completedTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <TaskTable tasks={completedTasks} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function TaskTable({
  tasks,
}: {
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    assignee: string | null;
    due_date: string | null;
  }>;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">Priority</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Assignee</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="w-28">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const dueDate = task.due_date ? new Date(task.due_date) : null;
          const isOverdue =
            dueDate &&
            isValid(dueDate) &&
            isPast(dueDate) &&
            task.status !== "done";

          return (
            <TableRow
              key={task.id}
              className={cn(isOverdue && "bg-red-50 dark:bg-red-950/20")}
            >
              <TableCell>
                <Badge variant={priorityVariant[task.priority] ?? "outline"}>
                  {task.priority}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{task.title}</TableCell>
              <TableCell>{task.assignee ?? "—"}</TableCell>
              <TableCell
                className={cn(
                  "whitespace-nowrap",
                  isOverdue && "font-medium text-red-600 dark:text-red-400",
                )}
              >
                {dueDate && isValid(dueDate)
                  ? format(dueDate, "d MMM yyyy")
                  : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant[task.status] ?? "outline"}>
                  {task.status.replace("_", " ")}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

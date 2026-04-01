import Link from "next/link";
import { CheckSquare, Circle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  low: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export async function TasksCard() {
  const clientId = await getActiveClientId();
  const supabase = createAdminClient();

  let tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  }> = [];
  let totalOpen = 0;

  if (supabase && clientId) {
    const { data, count } = await supabase
      .from("tasks")
      .select("id, title, status, priority, due_date", { count: "exact" })
      .eq("client_id", clientId)
      .in("status", ["todo", "in_progress"])
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(5);

    tasks = data ?? [];
    totalOpen = count ?? 0;
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">
          Active Tasks
          {totalOpen > 0 && (
            <span className="ml-2 text-muted-foreground font-normal">
              ({totalOpen})
            </span>
          )}
        </CardTitle>
        <CheckSquare className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks.</p>
        ) : (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-start gap-2 text-sm">
                <Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <span className="line-clamp-1">{task.title}</span>
                  {task.due_date && (
                    <span className="text-xs text-muted-foreground ml-1">
                      (due{" "}
                      {new Date(task.due_date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })}
                      )
                    </span>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-xs ${priorityColors[task.priority] || ""}`}
                >
                  {task.priority}
                </Badge>
              </div>
            ))}
            {totalOpen > 5 && (
              <Link href="/tasks">
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-7 text-xs w-full"
                >
                  View all {totalOpen} tasks
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

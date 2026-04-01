import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { TaskList } from "@/components/tasks/task-list";
import type { Task } from "@/lib/types";

async function getTasksData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { tasks: [] };

  const supabase = createClient();
  if (!supabase) return { tasks: [] };

  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  return { tasks: (data ?? []) as Task[] };
}

export default async function TasksPage() {
  const { tasks } = await getTasksData();

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      <p className="mt-2 text-muted-foreground">
        Track work items and action items.
      </p>
      <div className="mt-6">
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
}

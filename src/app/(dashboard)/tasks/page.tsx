import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { getCredentials } from "@/lib/services/trello-auth-service";
import { TaskList } from "@/components/tasks/task-list";
import type { Task, CrmCustomer } from "@/lib/types";

async function getTasksData() {
  const clientId = await getActiveClientId();
  if (!clientId) return { tasks: [], customers: [] };

  const supabase = createClient();
  if (!supabase) return { tasks: [], customers: [] };

  const [tasksRes, customersRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("*, meetings(title)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("crm_customers")
      .select("id, name")
      .eq("client_id", clientId)
      .eq("status", "active")
      .order("name"),
  ]);

  return {
    tasks: (tasksRes.data ?? []) as (Task & {
      meetings: { title: string } | null;
    })[],
    customers: (customersRes.data ?? []) as Pick<CrmCustomer, "id" | "name">[],
  };
}

async function isTrelloConnected(): Promise<boolean> {
  const supabase = await createServerSupabase();
  if (!supabase) return false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  try {
    const creds = await getCredentials(user.id);
    return !!creds;
  } catch {
    return false;
  }
}

export default async function TasksPage() {
  const [{ tasks, customers }, trelloConnected] = await Promise.all([
    getTasksData(),
    isTrelloConnected(),
  ]);

  return (
    <div className="animate-in">
      <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
      <p className="mt-2 text-muted-foreground">
        Track work items and action items.
      </p>
      <div className="mt-6">
        <TaskList
          tasks={tasks}
          customers={customers}
          trelloConnected={trelloConnected}
        />
      </div>
    </div>
  );
}

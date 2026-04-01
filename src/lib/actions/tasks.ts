"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import { taskSchema, type TaskFormData } from "@/lib/validations/tasks";
import {
  notifyTaskCreated,
  notifyTaskCompleted,
} from "@/lib/services/slack-notification-service";

export async function createTask(data: TaskFormData) {
  const parsed = taskSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      client_id: clientId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignee: parsed.data.assignee || null,
      assignee_type: parsed.data.assignee_type,
      due_date: parsed.data.due_date || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/tasks");

  notifyTaskCreated(task.id).catch((err) =>
    console.error("Slack notification failed:", err),
  );

  return { success: true };
}

export async function updateTask(id: string, data: TaskFormData) {
  const parsed = taskSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      assignee: parsed.data.assignee || null,
      assignee_type: parsed.data.assignee_type,
      due_date: parsed.data.due_date || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function deleteTask(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");
  return { success: true };
}

export async function updateTaskStatus(id: string, status: string) {
  const validStatuses = ["todo", "in_progress", "blocked", "done"];
  if (!validStatuses.includes(status)) {
    return { error: "Invalid status" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("tasks")
    .update({ status })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/tasks");

  if (status === "done") {
    notifyTaskCompleted(id).catch((err) =>
      console.error("Slack notification failed:", err),
    );
  }

  return { success: true };
}

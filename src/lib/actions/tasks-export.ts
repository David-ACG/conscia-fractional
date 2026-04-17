"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  listBoards,
  listLists,
  exportTasks,
  type TrelloBoard,
  type TrelloList,
  type ExportMode,
  type ExportResult,
} from "@/lib/services/trello-export-service";
import { getCredentials } from "@/lib/services/trello-auth-service";
import type { Task } from "@/lib/types";

async function getUserId(): Promise<string | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function listTrelloBoardsAction(): Promise<{
  boards?: TrelloBoard[];
  error?: string;
}> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const creds = await getCredentials(userId);
  if (!creds) return { error: "Trello not connected" };

  try {
    const boards = await listBoards(userId);
    return { boards };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load boards";
    return { error: message };
  }
}

export async function listTrelloListsAction(
  boardId: string,
): Promise<{ lists?: TrelloList[]; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const creds = await getCredentials(userId);
  if (!creds) return { error: "Trello not connected" };

  try {
    const lists = await listLists(userId, boardId);
    return { lists };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load lists";
    return { error: message };
  }
}

export async function exportTasksToTrelloAction(input: {
  taskIds: string[];
  boardId: string;
  statusToListMap: Record<"todo" | "in_progress" | "blocked" | "done", string>;
  mode: ExportMode;
}): Promise<{ result?: ExportResult; error?: string }> {
  const userId = await getUserId();
  if (!userId) return { error: "Not authenticated" };

  const creds = await getCredentials(userId);
  if (!creds) return { error: "Trello not connected" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  if (input.taskIds.length === 0) {
    return { result: { created: 0, skipped: 0, failed: [] } };
  }

  const admin = createAdminClient();
  if (!admin) return { error: "Database unavailable" };

  const { data, error } = await admin
    .from("tasks")
    .select("*")
    .in("id", input.taskIds)
    .eq("client_id", clientId);

  if (error) return { error: error.message };

  const tasks = (data ?? []) as Task[];

  try {
    const result = await exportTasks({
      userId,
      tasks,
      statusToListMap: input.statusToListMap,
      mode: input.mode,
    });
    revalidatePath("/tasks");
    return { result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Export failed";
    return { error: message };
  }
}

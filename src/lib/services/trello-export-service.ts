import { getCredentials } from "@/lib/services/trello-auth-service";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Task } from "@/lib/types";

export type TrelloBoard = { id: string; name: string; url: string };
export type TrelloList = { id: string; name: string; pos: number };
export type ExportMode = "skip-exported" | "overwrite";
export type ExportResult = {
  created: number;
  skipped: number;
  failed: { taskId: string; reason: string }[];
};

const TRELLO_BASE = "https://api.trello.com/1";
const THROTTLE_MS = 125;

function redactUrl(url: string): string {
  const idx = url.indexOf("?");
  return idx === -1 ? url : url.substring(0, idx);
}

async function getAuth(
  userId: string,
): Promise<{ apiKey: string; token: string }> {
  const creds = await getCredentials(userId);
  if (!creds) throw new Error("Trello not connected");
  return { apiKey: creds.apiKey, token: creds.token };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listBoards(userId: string): Promise<TrelloBoard[]> {
  const { apiKey, token } = await getAuth(userId);
  const params = new URLSearchParams({
    key: apiKey,
    token,
    filter: "open",
    fields: "name,url",
  });
  const url = `${TRELLO_BASE}/members/me/boards?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Trello listBoards failed: ${response.status} (${redactUrl(url)})`,
    );
  }
  const data = (await response.json()) as Array<{
    id: string;
    name: string;
    url: string;
  }>;
  return data.map((b) => ({ id: b.id, name: b.name, url: b.url }));
}

export async function listLists(
  userId: string,
  boardId: string,
): Promise<TrelloList[]> {
  const { apiKey, token } = await getAuth(userId);
  const params = new URLSearchParams({
    key: apiKey,
    token,
    fields: "name,pos",
  });
  const url = `${TRELLO_BASE}/boards/${boardId}/lists?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Trello listLists failed: ${response.status} (${redactUrl(url)})`,
    );
  }
  const data = (await response.json()) as Array<{
    id: string;
    name: string;
    pos: number;
  }>;
  return data.map((l) => ({ id: l.id, name: l.name, pos: l.pos }));
}

function buildDescription(task: Task): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";
  const baseDesc = task.description ?? "";
  const summary = `Priority: ${task.priority}  ·  Owner: ${task.assignee ?? "—"}  ·  Due: ${task.due_date ?? "—"}`;
  const link = `Exported from FractionalBuddy — ${siteUrl}/tasks?id=${task.id}`;
  return `${baseDesc}\n\n---\n${summary}\n${link}`;
}

async function postCard(
  apiKey: string,
  token: string,
  payload: {
    idList: string;
    name: string;
    desc: string;
    due?: string;
    pos: string;
  },
): Promise<Response> {
  const params = new URLSearchParams({
    key: apiKey,
    token,
    idList: payload.idList,
    name: payload.name,
    desc: payload.desc,
    pos: payload.pos,
  });
  if (payload.due) params.set("due", payload.due);
  const url = `${TRELLO_BASE}/cards?${params.toString()}`;
  return fetch(url, { method: "POST" });
}

export async function exportTasks(params: {
  userId: string;
  tasks: Task[];
  statusToListMap: Record<
    "todo" | "in_progress" | "blocked" | "done",
    string
  >;
  mode: ExportMode;
  onProgress?: (done: number, total: number) => void;
}): Promise<ExportResult> {
  const { userId, tasks, statusToListMap, mode, onProgress } = params;
  const { apiKey, token } = await getAuth(userId);
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const result: ExportResult = { created: 0, skipped: 0, failed: [] };
  const total = tasks.length;
  let done = 0;
  let lastPostStart: number | null = null;

  for (const task of tasks) {
    if (mode === "skip-exported" && task.trello_card_id) {
      result.skipped++;
      done++;
      onProgress?.(done, total);
      continue;
    }

    if (lastPostStart !== null) {
      const elapsed = Date.now() - lastPostStart;
      const wait = Math.max(0, THROTTLE_MS - elapsed);
      if (wait > 0) await sleep(wait);
    }
    lastPostStart = Date.now();

    const payload = {
      idList: statusToListMap[task.status],
      name: task.title,
      desc: buildDescription(task),
      due: task.due_date ? new Date(task.due_date).toISOString() : undefined,
      pos: "bottom",
    };

    let response: Response;
    try {
      response = await postCard(apiKey, token, payload);
    } catch {
      result.failed.push({ taskId: task.id, reason: "network_error" });
      done++;
      onProgress?.(done, total);
      continue;
    }

    if (response.status === 429) {
      const retryAfterRaw = response.headers.get("Retry-After");
      const retryAfter = retryAfterRaw ? parseInt(retryAfterRaw, 10) : 1;
      await sleep(Math.max(1, retryAfter) * 1000);
      try {
        response = await postCard(apiKey, token, payload);
      } catch {
        result.failed.push({ taskId: task.id, reason: "network_error" });
        done++;
        onProgress?.(done, total);
        continue;
      }
      if (response.status === 429) {
        result.failed.push({ taskId: task.id, reason: "rate_limited" });
        done++;
        onProgress?.(done, total);
        continue;
      }
    }

    if (!response.ok) {
      result.failed.push({
        taskId: task.id,
        reason: `http_${response.status}`,
      });
      done++;
      onProgress?.(done, total);
      continue;
    }

    const card = (await response.json()) as { id: string };
    const cardId = card.id;

    try {
      const { error } = await supabase
        .from("tasks")
        .update({ trello_card_id: cardId })
        .eq("id", task.id);
      if (error) {
        result.created++;
        result.failed.push({
          taskId: task.id,
          reason: "card_created_but_not_persisted",
        });
      } else {
        result.created++;
      }
    } catch {
      result.created++;
      result.failed.push({
        taskId: task.id,
        reason: "card_created_but_not_persisted",
      });
    }

    done++;
    onProgress?.(done, total);
  }

  return result;
}

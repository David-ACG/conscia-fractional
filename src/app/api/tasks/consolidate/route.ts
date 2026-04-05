import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/services/claude-cli";

export async function POST() {
  const authClient = await createClient();
  if (!authClient) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  // Fetch all active tasks with their meeting titles
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, assignee, meeting_id, meetings(title)",
    )
    .neq("status", "done")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!tasks || tasks.length < 2) {
    return NextResponse.json({
      groups: [],
      message: "Not enough tasks to consolidate",
    });
  }

  // Build task list for Claude
  const taskList = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    assignee: t.assignee,
    meeting: (t.meetings as { title: string } | null)?.title ?? null,
  }));

  const prompt = `You are a task management assistant. Analyze these tasks and identify groups of similar/duplicate tasks that should be consolidated into one.

Rules:
- Only group tasks that are genuinely about the same work item
- Keep tasks separate if they have different assignees (unless one is null)
- Prefer the most descriptive title as the consolidated title
- Set priority to the highest among the group
- Return ONLY valid JSON

Tasks:
${JSON.stringify(taskList, null, 2)}

Return JSON:
{
  "groups": [
    {
      "consolidated_title": "Best title for the merged task",
      "consolidated_description": "Combined description",
      "priority": "high",
      "assignee": "Person or null",
      "task_ids": ["id1", "id2"],
      "reason": "Why these are similar"
    }
  ]
}

Only include groups with 2+ tasks. If no duplicates found, return {"groups": []}`;

  let result;
  try {
    result = await callClaude(prompt, { timeout: 120_000 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Claude consolidation failed:", msg);
    return NextResponse.json(
      { error: `Claude failed: ${msg.slice(0, 200)}` },
      { status: 500 },
    );
  }

  let rawJson = result.text.trim();
  const codeBlockMatch = rawJson.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    rawJson = codeBlockMatch[1]!.trim();
  }

  let parsed: {
    groups: Array<{
      consolidated_title: string;
      consolidated_description: string;
      priority: string;
      assignee: string | null;
      task_ids: string[];
      reason: string;
    }>;
  };

  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 },
    );
  }

  // Enrich groups with original task details
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const enrichedGroups = parsed.groups.map((group) => ({
    ...group,
    tasks: group.task_ids
      .map((id) => taskMap.get(id))
      .filter(Boolean)
      .map((t) => ({
        id: t!.id,
        title: t!.title,
        meeting: (t!.meetings as { title: string } | null)?.title ?? null,
      })),
  }));

  return NextResponse.json({ groups: enrichedGroups });
}

export async function PUT(request: Request) {
  const authClient = await createClient();
  if (!authClient) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  }

  const body = await request.json();
  const {
    consolidated_title,
    consolidated_description,
    priority,
    assignee,
    task_ids,
  } = body as {
    consolidated_title: string;
    consolidated_description: string;
    priority: string;
    assignee: string | null;
    task_ids: string[];
  };

  if (!task_ids || task_ids.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 tasks" },
      { status: 400 },
    );
  }

  // Fetch original tasks for the consolidation note
  const { data: originals } = await supabase
    .from("tasks")
    .select("id, title, meeting_id, meetings(title)")
    .in("id", task_ids);

  // Build consolidation note
  const noteLines = (originals ?? []).map((t) => {
    const meetingTitle = (t.meetings as { title: string } | null)?.title;
    return `- "${t.title}"${meetingTitle ? ` (from meeting: ${meetingTitle})` : ""}`;
  });

  const consolidationNote = `## Consolidated from ${task_ids.length} tasks\n${noteLines.join("\n")}`;

  const fullDescription = consolidated_description
    ? `${consolidated_description}\n\n${consolidationNote}`
    : consolidationNote;

  // Keep the first task, update it as the consolidated one
  const keepId = task_ids[0];
  const removeIds = task_ids.slice(1);

  // Get client_id from the first task
  const { data: firstTask } = await supabase
    .from("tasks")
    .select("client_id, meeting_id")
    .eq("id", keepId)
    .single();

  if (!firstTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Update the kept task
  await supabase
    .from("tasks")
    .update({
      title: consolidated_title,
      description: fullDescription,
      priority,
      assignee: assignee || null,
    })
    .eq("id", keepId);

  // Mark removed tasks as done with a note pointing to the consolidated task
  for (const removeId of removeIds) {
    await supabase
      .from("tasks")
      .update({
        status: "done",
        description: `Consolidated into: "${consolidated_title}"`,
      })
      .eq("id", removeId);
  }

  return NextResponse.json({
    success: true,
    kept_id: keepId,
    removed: removeIds.length,
  });
}

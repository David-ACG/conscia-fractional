import { z } from "zod";

export const taskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().default(""),
  status: z.enum(["todo", "in_progress", "blocked", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignee: z.string().optional().default(""),
  assignee_type: z.enum(["self", "client_team", "external"]).default("self"),
  due_date: z.string().optional().default(""),
  is_client_visible: z.boolean().default(false),
});

export type TaskFormData = z.infer<typeof taskSchema>;

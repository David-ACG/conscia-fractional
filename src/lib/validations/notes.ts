import { z } from "zod";

export const noteSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional().default(""),
  note_type: z.enum(["note", "decision", "context"]).default("note"),
  tags: z.array(z.string()).default([]),
  is_client_visible: z.boolean().default(false),
});

export type NoteFormData = z.infer<typeof noteSchema>;

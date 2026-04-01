import { z } from "zod";

export const researchSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().optional().default(""),
  research_type: z
    .enum(["architecture", "competitor", "technology", "market", "other"])
    .default("architecture"),
  tags: z.array(z.string()).default([]),
  is_client_visible: z.boolean().default(false),
});

export type ResearchFormData = z.infer<typeof researchSchema>;

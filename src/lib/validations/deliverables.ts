import { z } from "zod";

export const deliverableSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  crm_customer_id: z.string().optional().default(""),
  status: z
    .enum(["draft", "in_progress", "review", "delivered"])
    .default("draft"),
  due_date: z.string().optional().default(""),
  file_url: z.string().optional().default(""),
  file_name: z.string().optional().default(""),
  is_client_visible: z.boolean().default(false),
});

export type DeliverableFormData = z.infer<typeof deliverableSchema>;

export const newVersionSchema = z.object({
  notes: z.string().optional().default(""),
  file_url: z.string().optional().default(""),
  file_name: z.string().optional().default(""),
});

export type NewVersionFormData = z.infer<typeof newVersionSchema>;

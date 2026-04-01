import { z } from "zod";

export const crmCustomerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  industry: z.string().optional().default(""),
  description: z.string().optional().default(""),
  status: z
    .enum(["prospect", "active", "completed", "lost"])
    .default("prospect"),
  primary_contact: z.string().optional().default(""),
  google_drive_url: z
    .string()
    .url("Invalid URL")
    .or(z.literal(""))
    .optional()
    .default(""),
  is_client_visible: z.boolean().default(false),
});

export type CrmCustomerFormData = z.infer<typeof crmCustomerSchema>;

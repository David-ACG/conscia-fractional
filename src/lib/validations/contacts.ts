import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().optional().default(""),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().default(""),
  slack_id: z.string().optional().default(""),
  linkedin_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  preferred_contact_method: z
    .enum(["slack", "email", "phone", "teams"])
    .default("email"),
  skills: z.array(z.string()).default([]),
  working_on: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  is_client_visible: z.boolean().default(false),
});

export type ContactFormData = z.infer<typeof contactSchema>;

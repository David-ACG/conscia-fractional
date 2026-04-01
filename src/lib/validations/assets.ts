import { z } from "zod";

export const assetSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  asset_type: z
    .enum(["template", "diagram", "document", "other"])
    .default("template"),
  file_url: z.string().optional().default(""),
  file_name: z.string().optional().default(""),
  crm_customer_id: z.string().optional().default(""),
  is_client_visible: z.boolean().default(false),
});

export type AssetFormData = z.infer<typeof assetSchema>;

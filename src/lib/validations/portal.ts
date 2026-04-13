import { z } from "zod";

export const portalSettingsUpdateSchema = z.object({
  module: z.enum([
    "customers",
    "timesheet",
    "tasks",
    "meetings",
    "deliverables",
    "invoicing",
    "notes",
    "research",
  ]),
  is_enabled: z.boolean(),
});

export const portalInviteSchema = z.object({
  email: z.string().email("Valid email required"),
});

export type PortalSettingsUpdateData = z.infer<
  typeof portalSettingsUpdateSchema
>;
export type PortalInviteData = z.infer<typeof portalInviteSchema>;

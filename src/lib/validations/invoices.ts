import { z } from "zod";

export const invoiceCreateSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  period_start: z.string().min(1, "Start date is required"),
  period_end: z.string().min(1, "End date is required"),
  status: z
    .enum(["draft", "sent", "viewed", "overdue", "paid"])
    .default("draft"),
});

export type InvoiceCreateData = z.infer<typeof invoiceCreateSchema>;

export const invoiceUpdateSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required").optional(),
  status: z.enum(["draft", "sent", "viewed", "overdue", "paid"]).optional(),
  paid_on: z.string().nullable().optional(),
  is_client_visible: z.boolean().optional(),
});

export type InvoiceUpdateData = z.infer<typeof invoiceUpdateSchema>;

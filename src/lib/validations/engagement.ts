import { z } from "zod";

export const scopeCreepSchema = z.object({
  description: z.string().min(1, "Description is required"),
  requested_by: z.string().optional().default(""),
  requested_date: z.string().optional().default(""),
  status: z
    .enum(["logged", "discussed", "accepted", "declined"])
    .default("logged"),
  notes: z.string().optional().default(""),
});

export type ScopeCreepFormData = z.infer<typeof scopeCreepSchema>;

export const questionnaireAnswerSchema = z.record(z.string(), z.unknown());

export type QuestionnaireAnswers = z.infer<typeof questionnaireAnswerSchema>;

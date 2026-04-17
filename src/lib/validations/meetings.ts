import { z } from "zod";

const meetingAttendeeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  role: z.string().optional().default(""),
});

export const meetingSchema = z.object({
  title: z.string().min(1, "Title is required"),
  meeting_date: z.string().min(1, "Date is required"),
  duration_minutes: z.coerce.number().int().positive().optional(),
  crm_customer_id: z.string().optional().default(""),
  attendees: z.array(meetingAttendeeSchema).default([]),
  summary: z.string().optional().default(""),
  transcript: z.string().optional().default(""),
  recording_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  platform: z.enum(["zoom", "teams", "meet"]).optional(),
});

export type MeetingFormData = z.infer<typeof meetingSchema>;

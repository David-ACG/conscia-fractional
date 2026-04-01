"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient as createClient } from "@/lib/supabase/admin";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  meetingSchema,
  type MeetingFormData,
} from "@/lib/validations/meetings";
import { notifyMeetingProcessed } from "@/lib/services/slack-notification-service";

/** Round minutes up to the nearest 15-minute increment */
function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

export async function createMeeting(data: MeetingFormData) {
  const parsed = meetingSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      title: parsed.data.title,
      meeting_date: parsed.data.meeting_date,
      duration_minutes: parsed.data.duration_minutes || null,
      crm_customer_id: parsed.data.crm_customer_id || null,
      attendees: parsed.data.attendees,
      summary: parsed.data.summary || null,
      transcript: parsed.data.transcript || null,
      recording_url: parsed.data.recording_url || null,
      platform: parsed.data.platform || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/meetings");
  return { success: true, meetingId: meeting.id };
}

export async function updateMeeting(id: string, data: MeetingFormData) {
  const parsed = meetingSchema.safeParse(data);
  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase
    .from("meetings")
    .update({
      title: parsed.data.title,
      meeting_date: parsed.data.meeting_date,
      duration_minutes: parsed.data.duration_minutes || null,
      crm_customer_id: parsed.data.crm_customer_id || null,
      attendees: parsed.data.attendees,
      summary: parsed.data.summary || null,
      transcript: parsed.data.transcript || null,
      recording_url: parsed.data.recording_url || null,
      platform: parsed.data.platform || null,
      is_client_visible: parsed.data.is_client_visible,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/meetings");
  return { success: true };
}

export async function deleteMeeting(id: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { error } = await supabase.from("meetings").delete().eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/meetings");
  return { success: true };
}

export async function logMeetingToTimesheet(meetingId: string) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const { data: meeting, error: fetchError } = await supabase
    .from("meetings")
    .select("title, duration_minutes, meeting_date, client_id, crm_customer_id")
    .eq("id", meetingId)
    .single();

  if (fetchError || !meeting) return { error: "Meeting not found" };

  if (!meeting.duration_minutes)
    return { error: "Meeting has no duration set" };

  const billableMinutes = roundUpTo15(meeting.duration_minutes);
  const startedAt = meeting.meeting_date || new Date().toISOString();
  const stoppedAt = new Date(
    new Date(startedAt).getTime() + billableMinutes * 60 * 1000,
  ).toISOString();

  const { error: insertError } = await supabase.from("time_entries").insert({
    client_id: meeting.client_id,
    crm_customer_id: meeting.crm_customer_id,
    category: "Meeting",
    description: meeting.title,
    started_at: startedAt,
    stopped_at: stoppedAt,
    duration_minutes: billableMinutes,
    is_manual: true,
    meeting_id: meetingId,
    is_billable: true,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/meetings");
  revalidatePath("/timesheet");
  return { success: true };
}

// ─── Create meeting + tasks + timesheet from processed transcript ────

interface TranscriptTask {
  title: string;
  description: string;
  priority: string;
  assignee: string | null;
  assignee_type: string;
  confidence: string;
  source_quote: string;
}

interface ProcessedTranscript {
  title: string;
  summary: string;
  tasks: TranscriptTask[];
  durationMinutes: number;
  speakers: string[];
  meetingDate: string | null;
  rawTranscript: string;
  platform?: string;
}

export async function createMeetingFromTranscript(data: ProcessedTranscript) {
  const supabase = createClient();
  if (!supabase) return { error: "Database unavailable" };

  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  const meetingDate = data.meetingDate || new Date().toISOString();

  // 1. Create the meeting
  const attendees = data.speakers.map((name) => ({ name }));
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      title: data.title,
      meeting_date: meetingDate,
      duration_minutes: data.durationMinutes,
      attendees,
      summary: data.summary,
      transcript: data.rawTranscript,
      platform: data.platform || null,
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (meetingError) return { error: meetingError.message };

  const meetingId = meeting.id;

  // 2. Create tasks linked to the meeting
  if (data.tasks.length > 0) {
    const taskRows = data.tasks.map((t) => ({
      client_id: clientId,
      meeting_id: meetingId,
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority || "medium",
      assignee: t.assignee || null,
      assignee_type: t.assignee_type || "self",
      confidence: t.confidence || null,
      source_quote: t.source_quote || null,
      is_client_visible: false,
    }));

    const { error: tasksError } = await supabase.from("tasks").insert(taskRows);

    if (tasksError) {
      // Non-fatal: meeting was created, tasks failed
      console.error("Failed to create tasks:", tasksError.message);
    }
  }

  // 3. Log to timesheet (round up to nearest 15 mins)
  if (data.durationMinutes > 0) {
    const billableMinutes = roundUpTo15(data.durationMinutes);
    const stoppedAt = new Date(
      new Date(meetingDate).getTime() + billableMinutes * 60 * 1000,
    ).toISOString();

    const { error: timeError } = await supabase.from("time_entries").insert({
      client_id: clientId,
      category: "Meeting",
      description: data.title,
      started_at: meetingDate,
      stopped_at: stoppedAt,
      duration_minutes: billableMinutes,
      is_manual: true,
      meeting_id: meetingId,
      is_billable: true,
    });

    if (timeError) {
      console.error("Failed to log timesheet:", timeError.message);
    }
  }

  revalidatePath("/meetings");
  revalidatePath("/tasks");
  revalidatePath("/timesheet");

  try {
    await notifyMeetingProcessed(meetingId);
  } catch (error) {
    console.error("Slack notification failed:", error);
  }

  return { success: true, meetingId };
}

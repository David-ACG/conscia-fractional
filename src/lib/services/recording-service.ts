import { createAdminClient } from "@/lib/supabase/admin";
import { extractMeetingData } from "@/lib/services/transcript-extraction-service";
import type { TranscriptSegment } from "@/lib/types/transcription";

export interface ProcessUploadedRecordingParams {
  segments: TranscriptSegment[];
  audioUrl: string;
  durationSeconds: number;
  userId: string;
  clientId: string;
  crmCustomerId?: string;
  fileName?: string;
}

function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

function msToSrtTimestamp(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  const mss = ms % 1_000;
  return (
    [
      h.toString().padStart(2, "0"),
      m.toString().padStart(2, "0"),
      s.toString().padStart(2, "0"),
    ].join(":") +
    "," +
    mss.toString().padStart(3, "0")
  );
}

/** Convert TranscriptSegment[] to SRT format parseable by transcript-parser.ts */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg) => {
      const start = msToSrtTimestamp(seg.startMs);
      const end = msToSrtTimestamp(seg.endMs);
      return `${start} --> ${end} [${seg.speaker}]\n${seg.text}`;
    })
    .join("\n\n");
}

/** Upload audio blob to Supabase Storage, return signed URL */
export async function uploadAudio(
  audioBlob: Blob,
  userId: string,
  meetingId: string,
): Promise<string> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const path = `${userId}/${meetingId}/recording.webm`;

  const { error: uploadError } = await supabase.storage
    .from("meeting-recordings")
    .upload(path, audioBlob, { contentType: "audio/webm", upsert: true });

  if (uploadError)
    throw new Error(`Audio upload failed: ${uploadError.message}`);

  const { data: urlData, error: urlError } = await supabase.storage
    .from("meeting-recordings")
    .createSignedUrl(path, 60 * 60 * 24 * 365); // 1-year signed URL

  if (urlError || !urlData?.signedUrl) {
    throw new Error(`Failed to generate signed URL: ${urlError?.message}`);
  }

  return urlData.signedUrl;
}

export interface ProcessRecordingParams {
  segments: TranscriptSegment[];
  audioBlob: Blob;
  durationSeconds: number;
  userId: string;
  clientId: string;
  crmCustomerId?: string;
}

export interface ProcessRecordingResult {
  meetingId: string;
  title: string;
  summary: string;
  tasks: Array<{ title: string; description: string; priority: string }>;
  timeEntryId: string;
  audioUrl: string;
}

export async function processRecording(
  params: ProcessRecordingParams,
): Promise<ProcessRecordingResult> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const {
    segments,
    audioBlob,
    durationSeconds,
    userId,
    clientId,
    crmCustomerId,
  } = params;

  // 1. Convert segments to SRT
  const srt = segmentsToSrt(segments);

  // 2. Calculate duration
  const durationMinutes = roundUpTo15(Math.ceil(durationSeconds / 60));

  // 3. Extract unique speakers for attendees
  const speakerSet = new Set(segments.map((s) => s.speaker));
  const attendees = Array.from(speakerSet).map((name) => ({ name }));

  // 4. Create initial meeting record
  const now = new Date();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      title: "Processing recording...",
      meeting_date: now.toISOString(),
      duration_minutes: durationMinutes,
      attendees,
      transcript: srt,
      platform: null,
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (meetingError || !meeting) {
    throw new Error(`Failed to create meeting: ${meetingError?.message}`);
  }

  const meetingId = meeting.id as string;

  // 5. Upload audio
  const audioUrl = await uploadAudio(audioBlob, userId, meetingId);

  // 6. Update meeting with recording URL
  await supabase
    .from("meetings")
    .update({ recording_url: audioUrl })
    .eq("id", meetingId);

  // 7. Extract meeting data via Claude
  const extracted = await extractMeetingData(srt);

  // 8. Update meeting with extracted data
  await supabase
    .from("meetings")
    .update({
      title: extracted.title,
      summary: extracted.summary,
    })
    .eq("id", meetingId);

  // 9. Create tasks
  if (extracted.tasks.length > 0) {
    const taskRows = extracted.tasks.map((t) => ({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      meeting_id: meetingId,
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority ?? "medium",
      assignee: t.assignee ?? null,
      assignee_type: t.assignee_type ?? "self",
      confidence: t.confidence ?? null,
      source_quote: t.source_quote ?? null,
      is_client_visible: false,
    }));

    const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
    if (tasksError) {
      // Non-fatal: log and continue
      console.error("Failed to create tasks:", tasksError.message);
    }
  }

  // 10. Create auto time entry
  const stoppedAt = now.toISOString();
  const startedAt = new Date(
    now.getTime() - durationMinutes * 60 * 1000,
  ).toISOString();

  const { data: timeEntry, error: timeError } = await supabase
    .from("time_entries")
    .insert({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      category: "Meeting",
      description: extracted.title,
      started_at: startedAt,
      stopped_at: stoppedAt,
      duration_minutes: durationMinutes,
      is_manual: false,
      meeting_id: meetingId,
      is_billable: true,
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (timeError) {
    console.error("Failed to create time entry:", timeError.message);
  }

  return {
    meetingId,
    title: extracted.title,
    summary: extracted.summary,
    tasks: extracted.tasks.map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
    })),
    timeEntryId: timeEntry?.id ?? "",
    audioUrl,
  };
}

/** Process a recording that has already been uploaded to storage (URL-based, no re-upload) */
export async function processUploadedRecording(
  params: ProcessUploadedRecordingParams,
): Promise<ProcessRecordingResult> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Database unavailable");

  const {
    segments,
    audioUrl,
    durationSeconds,
    clientId,
    crmCustomerId,
    fileName,
  } = params;

  // 1. Convert segments to SRT
  const srt = segmentsToSrt(segments);

  // 2. Calculate duration
  const durationMinutes = roundUpTo15(Math.ceil(durationSeconds / 60));

  // 3. Extract unique speakers for attendees
  const speakerSet = new Set(segments.map((s) => s.speaker));
  const attendees = Array.from(speakerSet).map((name) => ({ name }));

  // 4. Create meeting with recording URL already set
  const now = new Date();
  const { data: meeting, error: meetingError } = await supabase
    .from("meetings")
    .insert({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      title: fileName ? `Processing: ${fileName}` : "Processing recording...",
      meeting_date: now.toISOString(),
      duration_minutes: durationMinutes,
      attendees,
      transcript: srt,
      recording_url: audioUrl,
      platform: null,
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (meetingError || !meeting) {
    throw new Error(`Failed to create meeting: ${meetingError?.message}`);
  }

  const meetingId = meeting.id as string;

  // 5. Extract meeting data via Claude
  const extracted = await extractMeetingData(srt);

  // 6. Update meeting with extracted data
  await supabase
    .from("meetings")
    .update({
      title: extracted.title,
      summary: extracted.summary,
    })
    .eq("id", meetingId);

  // 7. Create tasks
  if (extracted.tasks.length > 0) {
    const taskRows = extracted.tasks.map((t) => ({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      meeting_id: meetingId,
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority ?? "medium",
      assignee: t.assignee ?? null,
      assignee_type: t.assignee_type ?? "self",
      confidence: t.confidence ?? null,
      source_quote: t.source_quote ?? null,
      is_client_visible: false,
    }));

    const { error: tasksError } = await supabase.from("tasks").insert(taskRows);
    if (tasksError) {
      console.error("Failed to create tasks:", tasksError.message);
    }
  }

  // 8. Create auto time entry
  const stoppedAt = now.toISOString();
  const startedAt = new Date(
    now.getTime() - durationMinutes * 60 * 1000,
  ).toISOString();

  const { data: timeEntry, error: timeError } = await supabase
    .from("time_entries")
    .insert({
      client_id: clientId,
      crm_customer_id: crmCustomerId ?? null,
      category: "Meeting",
      description: extracted.title,
      started_at: startedAt,
      stopped_at: stoppedAt,
      duration_minutes: durationMinutes,
      is_manual: false,
      meeting_id: meetingId,
      is_billable: true,
      is_client_visible: false,
    })
    .select("id")
    .single();

  if (timeError) {
    console.error("Failed to create time entry:", timeError.message);
  }

  return {
    meetingId,
    title: extracted.title,
    summary: extracted.summary,
    tasks: extracted.tasks.map((t) => ({
      title: t.title,
      description: t.description,
      priority: t.priority,
    })),
    timeEntryId: timeEntry?.id ?? "",
    audioUrl,
  };
}

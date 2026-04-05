"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getActiveClientId } from "@/lib/actions/clients";
import {
  processRecording,
  processUploadedRecording,
} from "@/lib/services/recording-service";
import type { TranscriptSegment } from "@/lib/types/transcription";

export async function processRecordingAction(
  formData: FormData,
): Promise<{ meetingId: string } | { error: string }> {
  // Get authenticated user
  const supabase = await createClient();
  if (!supabase) return { error: "Database unavailable" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get active client
  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  // Parse FormData
  const segmentsJson = formData.get("segments");
  const audioFile = formData.get("audio");
  const durationStr = formData.get("duration");

  if (!segmentsJson || typeof segmentsJson !== "string") {
    return { error: "Missing segments data" };
  }
  if (!audioFile || !(audioFile instanceof Blob)) {
    return { error: "Missing audio file" };
  }
  if (!durationStr || typeof durationStr !== "string") {
    return { error: "Missing duration" };
  }

  let segments: TranscriptSegment[];
  try {
    segments = JSON.parse(segmentsJson) as TranscriptSegment[];
  } catch {
    return { error: "Invalid segments data" };
  }

  const durationSeconds = parseInt(durationStr, 10);
  if (isNaN(durationSeconds)) return { error: "Invalid duration" };

  const crmCustomerIdRaw = formData.get("crm_customer_id");
  const crmCustomerId =
    typeof crmCustomerIdRaw === "string" && crmCustomerIdRaw
      ? crmCustomerIdRaw
      : undefined;

  try {
    const result = await processRecording({
      segments,
      audioBlob: audioFile,
      durationSeconds,
      userId: user.id,
      clientId,
      crmCustomerId,
    });

    revalidatePath("/meetings");
    revalidatePath("/tasks");
    revalidatePath("/timesheet");

    return { meetingId: result.meetingId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return { error: message };
  }
}

export async function processUploadedRecordingAction(
  formData: FormData,
): Promise<{ meetingId: string } | { error: string }> {
  // Get authenticated user
  const supabase = await createClient();
  if (!supabase) return { error: "Database unavailable" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get active client
  const clientId = await getActiveClientId();
  if (!clientId) return { error: "No active client selected" };

  // Parse FormData
  const segmentsJson = formData.get("segments");
  const audioUrl = formData.get("audioUrl");
  const durationStr = formData.get("duration");
  const fileName = formData.get("fileName");

  if (!segmentsJson || typeof segmentsJson !== "string") {
    return { error: "Missing segments data" };
  }
  if (!audioUrl || typeof audioUrl !== "string") {
    return { error: "Missing audio URL" };
  }
  if (!durationStr || typeof durationStr !== "string") {
    return { error: "Missing duration" };
  }

  let segments: TranscriptSegment[];
  try {
    segments = JSON.parse(segmentsJson) as TranscriptSegment[];
  } catch {
    return { error: "Invalid segments data" };
  }

  const durationSeconds = parseInt(durationStr, 10);
  if (isNaN(durationSeconds)) return { error: "Invalid duration" };

  const crmCustomerIdRaw = formData.get("crm_customer_id");
  const crmCustomerId =
    typeof crmCustomerIdRaw === "string" && crmCustomerIdRaw
      ? crmCustomerIdRaw
      : undefined;

  try {
    const result = await processUploadedRecording({
      segments,
      audioUrl,
      durationSeconds,
      userId: user.id,
      clientId,
      fileName: typeof fileName === "string" ? fileName : undefined,
      crmCustomerId,
    });

    revalidatePath("/meetings");
    revalidatePath("/tasks");
    revalidatePath("/timesheet");

    return { meetingId: result.meetingId };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    return { error: message };
  }
}

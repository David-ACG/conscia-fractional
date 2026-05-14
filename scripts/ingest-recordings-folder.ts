/**
 * Upload local meeting recordings into Supabase Storage and create/update
 * FractionalBuddy meetings from them.
 *
 * Usage:
 *   npx tsx scripts/ingest-recordings-folder.ts
 *   npx tsx scripts/ingest-recordings-folder.ts "C:\path\to\recordings"
 */

import { execFileSync } from "child_process";
import { createServerClient } from "@supabase/ssr";
import * as fs from "fs";
import * as path from "path";
import { processUploadedRecording } from "@/lib/services/recording-service";
import { transcribeBatchFromBuffer } from "@/lib/services/transcription-service";
import { parseMeetingDateFromFilename } from "@/lib/services/filename-date-parser";

const DEFAULT_USER_ID = "d8df2932-b6f2-4fd8-8180-76d7021b7106";
const DEFAULT_FOLDER = path.join(
  __dirname,
  "..",
  "meetings",
  "original-recording",
);
const STORAGE_BUCKET = "meeting-recordings";
const STORAGE_PREFIX = `${DEFAULT_USER_ID}/manual-ingest`;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 365;

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    process.env[trimmed.slice(0, eq)] ??= trimmed.slice(eq + 1);
  }
}

function safeName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function titleFromFilename(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function roundUpTo15(minutes: number): number {
  return Math.ceil(minutes / 15) * 15;
}

function getDurationSeconds(filePath: string): number {
  const output = execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf-8" },
  ).trim();

  const seconds = Number.parseFloat(output);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`Could not read duration for ${filePath}`);
  }
  return Math.round(seconds);
}

function localIso(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 19);
}

function contentTypeFor(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".webm") return "audio/webm";
  return "audio/mp4";
}

function looksLikeLovesac(fileName: string): boolean {
  return /lovesac/i.test(fileName);
}

async function main() {
  loadEnv();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  );

  const folder = path.resolve(process.argv[2] ?? DEFAULT_FOLDER);
  const files = fs
    .readdirSync(folder)
    .filter((file) => /\.(m4a|mp3|wav|ogg|webm)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));

  const { data: clientRows, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .ilike("name", "%conscia%")
    .limit(1);
  if (clientError) throw clientError;
  const clientId = clientRows?.[0]?.id as string | undefined;
  if (!clientId) throw new Error("No Conscia client found");

  const { data: crmRows, error: crmError } = await supabase
    .from("crm_customers")
    .select("id")
    .eq("client_id", clientId)
    .ilike("name", "%lovesac%")
    .limit(1);
  if (crmError) throw crmError;
  const lovesacCustomerId = crmRows?.[0]?.id as string | undefined;

  console.log(`Scanning ${files.length} recording(s) in ${folder}`);

  for (const fileName of files) {
    const filePath = path.join(folder, fileName);
    const meetingDate = parseMeetingDateFromFilename(fileName);
    const durationSeconds = getDurationSeconds(filePath);
    const durationMinutes = roundUpTo15(Math.ceil(durationSeconds / 60));
    const storagePath = `${STORAGE_PREFIX}/${safeName(fileName)}`;

    const { data: byFilename, error: filenameError } = await supabase
      .from("meetings")
      .select("id, title, recording_url, original_filename")
      .eq("client_id", clientId)
      .eq("original_filename", fileName)
      .limit(1);
    if (filenameError) throw filenameError;

    let existingMeeting = byFilename?.[0];
    if (!existingMeeting && meetingDate) {
      const from = new Date(meetingDate.getTime() - 5 * 60_000).toISOString();
      const to = new Date(meetingDate.getTime() + 5 * 60_000).toISOString();
      const { data: byDate, error: dateError } = await supabase
        .from("meetings")
        .select("id, title, recording_url, original_filename")
        .eq("client_id", clientId)
        .gte("meeting_date", from)
        .lte("meeting_date", to)
        .order("meeting_date", { ascending: true })
        .limit(1);
      if (dateError) throw dateError;
      existingMeeting = byDate?.[0];
    }

    if (existingMeeting?.recording_url && existingMeeting.original_filename) {
      console.log(`SKIP ${fileName} -> ${existingMeeting.title}`);
      continue;
    }

    console.log(
      `UPLOAD ${fileName} (${(durationSeconds / 60).toFixed(1)} min)`,
    );
    const buffer = fs.readFileSync(filePath);
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: contentTypeFor(fileName),
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { data: urlData, error: urlError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
    if (urlError || !urlData?.signedUrl) {
      throw new Error(`Could not create signed URL for ${fileName}`);
    }

    if (existingMeeting) {
      const { error: updateError } = await supabase
        .from("meetings")
        .update({
          original_filename: fileName,
          recording_url: urlData.signedUrl,
          actual_duration_seconds: durationSeconds,
          duration_minutes: durationMinutes,
        })
        .eq("id", existingMeeting.id);
      if (updateError) throw updateError;
      console.log(`ATTACHED ${fileName} -> ${existingMeeting.title}`);
      continue;
    }

    console.log(`TRANSCRIBE ${fileName}`);
    const segments = await transcribeBatchFromBuffer(
      buffer,
      contentTypeFor(fileName),
    );
    if (segments.length === 0) {
      throw new Error(`Deepgram returned no utterances for ${fileName}`);
    }

    const result = await processUploadedRecording({
      segments,
      audioUrl: urlData.signedUrl,
      durationSeconds,
      userId: DEFAULT_USER_ID,
      clientId,
      crmCustomerId: looksLikeLovesac(fileName) ? lovesacCustomerId : undefined,
      fileName,
    });

    console.log(
      `CREATED ${fileName} -> ${result.title || titleFromFilename(fileName)} (${localIso(meetingDate ?? new Date())})`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedDriveClient } from "./google-drive-service";
import { extractText } from "./text-extraction-service";
import { chunkDocument } from "./chunking-service";
import { embedBatch } from "./embedding-service";
import {
  getQdrantClient,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/qdrant-client";

const MAX_INLINE_CONTENT_BYTES = 50 * 1024; // 50KB threshold for inline embedding

// Google Workspace MIME types that require export
const GOOGLE_EXPORT_MAP: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};

/** Queue a meeting for embedding. Creates a document record (embedded_at=null). */
export async function embedMeeting(
  meetingId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[auto-embed] Database unavailable, skipping embedMeeting");
    return;
  }

  // Fetch meeting record
  const { data: meeting, error: meetingError } = await admin
    .from("meetings")
    .select("id, title, meeting_date, transcript, crm_customer_id")
    .eq("id", meetingId)
    .single();

  if (meetingError || !meeting) {
    console.warn(
      `[auto-embed] Meeting ${meetingId} not found: ${meetingError?.message}`,
    );
    return;
  }

  if (!meeting.transcript) {
    console.warn(
      `[auto-embed] Meeting ${meetingId} has no transcript, skipping`,
    );
    return;
  }

  // Duplicate check
  const { data: existing } = await admin
    .from("documents")
    .select("id, embedded_at")
    .eq("source_type", "meeting")
    .eq("source_id", meetingId)
    .maybeSingle();

  if (existing) {
    if (existing.embedded_at !== null) {
      console.log(
        `[auto-embed] Meeting ${meetingId} already embedded, skipping`,
      );
      return;
    }
    // embedded_at is null → already queued, cron will handle it
    console.log(
      `[auto-embed] Meeting ${meetingId} already queued for embedding`,
    );
    return;
  }

  const meetingLabel =
    meeting.title ||
    (meeting.meeting_date
      ? new Date(meeting.meeting_date as string).toLocaleDateString()
      : meetingId);

  await admin.from("documents").insert({
    user_id: userId,
    crm_customer_id: meeting.crm_customer_id ?? null,
    name: `Meeting: ${meetingLabel}`,
    source_type: "meeting",
    source_id: meetingId,
    metadata: {
      meeting_date: meeting.meeting_date,
    },
  });
}

/** Queue a Google Drive file for embedding. Downloads content and stores it in metadata. */
export async function embedDriveFile(
  driveFileId: string,
  userId: string,
  integrationId: string,
  crmCustomerId?: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[auto-embed] Database unavailable, skipping embedDriveFile");
    return;
  }

  // Duplicate check
  const { data: existing } = await admin
    .from("documents")
    .select("id, embedded_at")
    .eq("source_type", "drive_file")
    .eq("source_id", driveFileId)
    .maybeSingle();

  if (existing?.embedded_at !== null && existing !== null) {
    console.log(
      `[auto-embed] Drive file ${driveFileId} already embedded, skipping`,
    );
    return;
  }

  // Download file from Google Drive
  const drive = await getAuthenticatedDriveClient(integrationId);

  // Get file metadata
  const metaResponse = await drive.files.get({
    fileId: driveFileId,
    fields: "id, name, mimeType, size",
  });
  const fileMeta = metaResponse.data;
  const fileName = fileMeta.name ?? driveFileId;
  const mimeType = fileMeta.mimeType ?? "application/octet-stream";

  let textContent: string;

  if (GOOGLE_EXPORT_MAP[mimeType]) {
    // Export Google Workspace file as plain text/CSV
    const exportMime = GOOGLE_EXPORT_MAP[mimeType];
    const exportResponse = await drive.files.export(
      { fileId: driveFileId, mimeType: exportMime },
      { responseType: "arraybuffer" },
    );
    const buffer = Buffer.from(exportResponse.data as ArrayBuffer);
    textContent = buffer.toString("utf-8");
  } else {
    // Download raw file
    const downloadResponse = await drive.files.get(
      { fileId: driveFileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    const buffer = Buffer.from(downloadResponse.data as ArrayBuffer);
    textContent = await extractText(buffer, mimeType);
  }

  const metadata: Record<string, unknown> = {
    drive_file_id: driveFileId,
    mime_type: mimeType,
  };

  // Store content inline if small enough
  if (Buffer.byteLength(textContent, "utf-8") <= MAX_INLINE_CONTENT_BYTES) {
    metadata.content = textContent;
  } else {
    metadata.content = textContent;
  }

  if (existing) {
    // Update existing pending record
    await admin
      .from("documents")
      .update({ metadata, name: fileName })
      .eq("id", existing.id);
  } else {
    await admin.from("documents").insert({
      user_id: userId,
      crm_customer_id: crmCustomerId ?? null,
      name: fileName,
      source_type: "drive_file",
      source_id: driveFileId,
      metadata,
    });
  }
}

/** Queue an asset for embedding. Downloads from file_url and extracts text. */
export async function embedAsset(
  assetId: string,
  userId: string,
): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[auto-embed] Database unavailable, skipping embedAsset");
    return;
  }

  // Fetch asset record
  const { data: asset, error: assetError } = await admin
    .from("assets")
    .select("id, name, file_url, file_name, crm_customer_id")
    .eq("id", assetId)
    .single();

  if (assetError || !asset) {
    console.warn(
      `[auto-embed] Asset ${assetId} not found: ${assetError?.message}`,
    );
    return;
  }

  if (!asset.file_url) {
    console.warn(`[auto-embed] Asset ${assetId} has no file_url, skipping`);
    return;
  }

  // Duplicate check
  const { data: existing } = await admin
    .from("documents")
    .select("id, embedded_at")
    .eq("source_type", "asset")
    .eq("source_id", assetId)
    .maybeSingle();

  if (existing?.embedded_at !== null && existing !== null) {
    console.log(`[auto-embed] Asset ${assetId} already embedded, skipping`);
    return;
  }

  // Download file from URL
  const response = await fetch(asset.file_url as string);
  if (!response.ok) {
    console.warn(
      `[auto-embed] Failed to download asset ${assetId}: ${response.status}`,
    );
    return;
  }

  const contentType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ?? "text/plain";
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  let textContent: string;
  try {
    textContent = await extractText(buffer, contentType);
  } catch {
    // Try as plain text fallback
    textContent = buffer.toString("utf-8");
  }

  if (existing) {
    await admin
      .from("documents")
      .update({ metadata: { content: textContent } })
      .eq("id", existing.id);
  } else {
    await admin.from("documents").insert({
      user_id: userId,
      crm_customer_id: (asset.crm_customer_id as string | null) ?? null,
      name: asset.name as string,
      source_type: "asset",
      source_id: assetId,
      metadata: { content: textContent },
    });
  }
}

/** Queue a note for embedding. Notes are already text — no extraction needed. */
export async function embedNote(noteId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn("[auto-embed] Database unavailable, skipping embedNote");
    return;
  }

  // Fetch note record
  const { data: note, error: noteError } = await admin
    .from("notes")
    .select("id, title, content")
    .eq("id", noteId)
    .single();

  if (noteError || !note) {
    console.warn(
      `[auto-embed] Note ${noteId} not found: ${noteError?.message}`,
    );
    return;
  }

  if (!note.content) {
    console.warn(`[auto-embed] Note ${noteId} has no content, skipping`);
    return;
  }

  // Duplicate check
  const { data: existing } = await admin
    .from("documents")
    .select("id, embedded_at")
    .eq("source_type", "note")
    .eq("source_id", noteId)
    .maybeSingle();

  if (existing?.embedded_at !== null && existing !== null) {
    console.log(`[auto-embed] Note ${noteId} already embedded, skipping`);
    return;
  }

  const textContent = `${note.title}\n\n${note.content}`;

  if (existing) {
    await admin
      .from("documents")
      .update({ metadata: { content: textContent } })
      .eq("id", existing.id);
  } else {
    await admin.from("documents").insert({
      user_id: userId,
      crm_customer_id: null,
      name: note.title as string,
      source_type: "note",
      source_id: noteId,
      metadata: { content: textContent },
    });
  }
}

/** Core function called by the cron job. Chunks, embeds, and stores in Qdrant. */
export async function processDocument(documentId: string): Promise<void> {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("Database unavailable");
  }

  // Fetch document record
  const { data: doc, error: docError } = await admin
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    throw new Error(
      `Document ${documentId} not found: ${docError?.message ?? "unknown"}`,
    );
  }

  // Get content
  let textContent: string | null = null;

  const meta = (doc.metadata ?? {}) as Record<string, unknown>;

  if (typeof meta.content === "string" && meta.content.length > 0) {
    textContent = meta.content;
  } else if (doc.source_type === "meeting") {
    // Re-fetch transcript from meetings table
    const { data: meeting } = await admin
      .from("meetings")
      .select("transcript")
      .eq("id", doc.source_id as string)
      .single();
    textContent = (meeting?.transcript as string | null) ?? null;
  } else if (doc.source_type === "upload") {
    // Upload documents are embedded at upload time; skip if no content in metadata
    console.log(
      `[auto-embed] Upload document ${documentId} has no pending content, skipping`,
    );
    return;
  }

  if (!textContent || textContent.trim().length === 0) {
    throw new Error(`Document ${documentId} has no content to embed`);
  }

  // Chunk content
  const preparedChunks = chunkDocument(textContent, {
    documentId,
    name: doc.name as string,
    sourceType: doc.source_type as string,
    crmCustomerId: doc.crm_customer_id as string | undefined,
    userId: doc.user_id as string,
  });

  if (preparedChunks.length === 0) {
    throw new Error(`Document ${documentId} produced no chunks`);
  }

  // Embed all chunks
  const texts = preparedChunks.map((c) => c.text);
  const vectors = await embedBatch(texts);

  // Ensure Qdrant collection exists
  await ensureCollection(COLLECTION_NAME, 4096);

  // Upsert points to Qdrant
  const qdrant = getQdrantClient();
  const points = preparedChunks.map((chunk, i) => ({
    id: crypto.randomUUID(),
    vector: vectors[i],
    payload: {
      document_id: documentId,
      chunk_index: chunk.index,
      content: chunk.text,
      source_type: doc.source_type,
      crm_customer_id: doc.crm_customer_id ?? null,
      user_id: doc.user_id,
      name: doc.name,
    },
  }));

  await qdrant.upsert(COLLECTION_NAME, { points });

  // Clean up metadata.content and update document record
  const updatedMeta = { ...meta };
  delete updatedMeta.content;

  await admin
    .from("documents")
    .update({
      chunk_count: preparedChunks.length,
      embedded_at: new Date().toISOString(),
      metadata: updatedMeta,
    })
    .eq("id", documentId);
}

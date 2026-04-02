import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { chunkDocument } from "@/lib/services/chunking-service";
import { embedBatch } from "@/lib/services/embedding-service";
import {
  getQdrantClient,
  ensureCollection,
  COLLECTION_NAME,
} from "@/lib/qdrant-client";

const BINARY_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-excel",
  "application/zip",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Verify authenticated user
  const cookieStore = await cookies();
  const supabaseClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let textContent: string;
  let documentName: string;
  let crmCustomerId: string | undefined;
  let sourceType = "upload";
  let sourceId: string | undefined;

  try {
    const formData = await request.formData();

    const nameValue = formData.get("name");
    if (!nameValue || typeof nameValue !== "string") {
      return NextResponse.json(
        { error: "Document name is required" },
        { status: 400 },
      );
    }
    documentName = nameValue;

    const crmCustomerValue = formData.get("crm_customer_id");
    if (crmCustomerValue && typeof crmCustomerValue === "string") {
      crmCustomerId = crmCustomerValue;
    }

    const sourceTypeValue = formData.get("source_type");
    if (sourceTypeValue && typeof sourceTypeValue === "string") {
      sourceType = sourceTypeValue;
    }

    const sourceIdValue = formData.get("source_id");
    if (sourceIdValue && typeof sourceIdValue === "string") {
      sourceId = sourceIdValue;
    }

    const textValue = formData.get("text");
    const fileValue = formData.get("file");

    if (textValue && typeof textValue === "string") {
      textContent = textValue;
    } else if (fileValue instanceof File) {
      if (BINARY_TYPES.includes(fileValue.type)) {
        return NextResponse.json(
          { error: "Binary file support coming soon" },
          { status: 400 },
        );
      }
      textContent = await fileValue.text();
    } else {
      return NextResponse.json(
        { error: "Either file or text is required" },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "Failed to parse request" },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Database connection unavailable" },
      { status: 503 },
    );
  }

  // Create document record
  const { data: docRecord, error: insertError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      name: documentName,
      source_type: sourceType,
      source_id: sourceId ?? null,
      crm_customer_id: crmCustomerId ?? null,
      metadata: { original_size: textContent.length },
    })
    .select()
    .single();

  if (insertError || !docRecord) {
    return NextResponse.json(
      { error: `Failed to create document record: ${insertError?.message}` },
      { status: 500 },
    );
  }

  const documentId: string = docRecord.id;

  try {
    // Chunk document
    const preparedChunks = chunkDocument(textContent, {
      documentId,
      name: documentName,
      sourceType,
      crmCustomerId,
      userId: user.id,
    });

    if (preparedChunks.length === 0) {
      return NextResponse.json(
        { error: "Document produced no chunks (empty content?)" },
        { status: 400 },
      );
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
        source_type: sourceType,
        crm_customer_id: crmCustomerId ?? null,
        user_id: user.id,
        name: documentName,
      },
    }));

    await qdrant.upsert(COLLECTION_NAME, { points });

    // Update document record with chunk count and embedded timestamp
    await supabase
      .from("documents")
      .update({
        chunk_count: preparedChunks.length,
        embedded_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    return NextResponse.json({
      document_id: documentId,
      chunk_count: preparedChunks.length,
      name: documentName,
    });
  } catch (err) {
    // Leave embedded_at as null — will be retried by cron
    console.error("Embedding failed:", err);
    return NextResponse.json(
      {
        error: "Embedding failed — document saved but not yet searchable",
        document_id: documentId,
      },
      { status: 500 },
    );
  }
}

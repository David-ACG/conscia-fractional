import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getQdrantClient, COLLECTION_NAME } from "@/lib/qdrant-client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: documentId } = await params;

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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database connection unavailable" },
      { status: 503 },
    );
  }

  // Verify the user owns this document
  const { data: doc, error: docError } = await admin
    .from("documents")
    .select("id, user_id, metadata")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  if (doc.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete existing Qdrant points for this document
  try {
    const qdrant = getQdrantClient();
    await qdrant.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "document_id",
            match: { value: documentId },
          },
        ],
      },
    });
  } catch (err) {
    // Log but don't fail — Qdrant might not have the collection yet
    console.warn(`[reembed] Qdrant delete failed for ${documentId}:`, err);
  }

  // Clear error metadata and reset embedded_at to re-queue
  const meta = (doc.metadata ?? {}) as Record<string, unknown>;
  const {
    embed_error: _e,
    embed_attempts: _a,
    ...cleanMeta
  } = meta as {
    embed_error?: unknown;
    embed_attempts?: unknown;
    [key: string]: unknown;
  };

  await admin
    .from("documents")
    .update({
      embedded_at: null,
      chunk_count: 0,
      metadata: cleanMeta,
    })
    .eq("id", documentId);

  return NextResponse.json({ success: true });
}

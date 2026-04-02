import { createAdminClient } from "@/lib/supabase/admin";
import { getQdrantClient, COLLECTION_NAME } from "@/lib/qdrant-client";

export interface Document {
  id: string;
  user_id: string;
  crm_customer_id: string | null;
  name: string;
  source_type: string;
  source_id: string | null;
  chunk_count: number;
  embedded_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function getDocuments(
  userId: string,
  crmCustomerId?: string,
): Promise<Document[]> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client unavailable");

  let query = supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (crmCustomerId) {
    query = query.eq("crm_customer_id", crmCustomerId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);
  return (data as Document[]) ?? [];
}

export async function getDocument(
  userId: string,
  documentId: string,
): Promise<Document | null> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client unavailable");

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // not found
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  return data as Document;
}

export async function deleteDocument(
  userId: string,
  documentId: string,
): Promise<void> {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase admin client unavailable");

  // Delete from Supabase
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId)
    .eq("user_id", userId);

  if (error) throw new Error(`Failed to delete document: ${error.message}`);

  // Delete associated vectors from Qdrant
  const qdrant = getQdrantClient();
  try {
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
  } catch {
    // Qdrant deletion failure is non-fatal — vectors will be orphaned but won't cause errors
    console.error(`Failed to delete Qdrant vectors for document ${documentId}`);
  }
}

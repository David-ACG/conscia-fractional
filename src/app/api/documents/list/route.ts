import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getDocuments } from "@/lib/services/document-service";

export async function GET(request: NextRequest) {
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

  const { searchParams } = new URL(request.url);
  const crmCustomerId = searchParams.get("crm_customer_id") ?? undefined;

  const documents = await getDocuments(user.id, crmCustomerId);

  const embedded_count = documents.filter((d) => d.embedded_at !== null).length;
  const total_chunks = documents.reduce(
    (sum, d) => sum + (d.chunk_count ?? 0),
    0,
  );

  return NextResponse.json({
    documents,
    total: documents.length,
    embedded_count,
    total_chunks,
  });
}

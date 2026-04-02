import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { search, generateAnswer } from "@/lib/services/rag-service";

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

  let body: {
    query?: unknown;
    crm_customer_id?: unknown;
    generate_answer?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { query, crm_customer_id, generate_answer } = body;

  if (!query || typeof query !== "string" || query.trim() === "") {
    return NextResponse.json(
      { error: "query must be a non-empty string" },
      { status: 400 },
    );
  }

  const crmCustomerId =
    typeof crm_customer_id === "string" && crm_customer_id
      ? crm_customer_id
      : undefined;

  try {
    const results = await search(query.trim(), {
      userId: user.id,
      crmCustomerId,
      limit: 5,
    });

    if (!generate_answer) {
      return NextResponse.json({ results });
    }

    // Look up CRM customer name for better context
    let crmCustomerName: string | undefined;
    if (crmCustomerId) {
      const supabase = createAdminClient();
      if (supabase) {
        const { data: customer } = await supabase
          .from("crm_customers")
          .select("name")
          .eq("id", crmCustomerId)
          .single();
        if (customer) {
          crmCustomerName = customer.name as string;
        }
      }
    }

    const { answer, sources } = await generateAnswer(query.trim(), results, {
      crmCustomerName,
    });

    return NextResponse.json({ answer, sources, results });
  } catch (err) {
    console.error("Document search error:", err);
    const message = err instanceof Error ? err.message : "Search failed";

    // Qdrant/Ollama connection failures
    if (
      message.includes("ECONNREFUSED") ||
      message.includes("fetch failed") ||
      message.includes("connect")
    ) {
      return NextResponse.json(
        { error: "Search service temporarily unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

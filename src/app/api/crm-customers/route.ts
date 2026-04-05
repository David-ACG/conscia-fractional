import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId");
  if (!clientId) return NextResponse.json([]);

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json([]);

  const { data } = await supabase
    .from("crm_customers")
    .select("id, name, slug, status")
    .eq("client_id", clientId)
    .order("status", { ascending: true }) // 'active' sorts first alphabetically
    .order("name")
    .limit(100);

  return NextResponse.json(data ?? []);
}

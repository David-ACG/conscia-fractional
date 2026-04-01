import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json([]);
  }

  const { data } = await supabase
    .from("clients")
    .select("id, name, slug, industry")
    .order("name");

  return NextResponse.json(data ?? []);
}

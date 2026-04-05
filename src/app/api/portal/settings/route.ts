import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  // Get authenticated user
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get their client_id from user_roles
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data: role } = await admin
    .from("user_roles")
    .select("client_id")
    .eq("user_id", user.id)
    .single();

  if (!role?.client_id) {
    return NextResponse.json({ error: "No client assigned" }, { status: 403 });
  }

  // Query enabled modules
  const { data: settings } = await admin
    .from("client_portal_settings")
    .select("module")
    .eq("client_id", role.client_id)
    .eq("is_enabled", true);

  return NextResponse.json({
    modules: (settings || []).map((s) => s.module),
  });
}

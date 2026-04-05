import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.redirect(
        new URL("/portal/login?error=auth_failed", request.url),
      );
    }

    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Update portal_invitations: set auth_user_id, status, accepted_at, last_login
      const admin = createAdminClient();
      if (admin) {
        const now = new Date().toISOString();

        await admin
          .from("portal_invitations")
          .update({
            auth_user_id: data.user.id,
            status: "accepted",
            accepted_at: now,
            last_login: now,
          })
          .eq("email", data.user.email!)
          .in("status", ["pending", "accepted"]);
      }

      return NextResponse.redirect(new URL("/portal", request.url));
    }
  }

  return NextResponse.redirect(
    new URL("/portal/login?error=auth_failed", request.url),
  );
}

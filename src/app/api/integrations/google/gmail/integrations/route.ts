import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.metadata",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

export async function GET() {
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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  const { data, error } = await admin
    .from("integrations")
    .select("id, account_identifier, scopes")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .eq("is_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const gmailIntegrations = (data ?? []).filter((i) =>
    (i.scopes as string[]).some((s) => GMAIL_SCOPES.includes(s)),
  );

  const sendIntegrations = gmailIntegrations.filter((i) =>
    (i.scopes as string[]).includes(GMAIL_SEND_SCOPE),
  );

  return NextResponse.json({
    integrations: gmailIntegrations.map((i) => ({
      id: i.id,
      account_identifier: i.account_identifier,
    })),
    sendIntegrations: sendIntegrations.map((i) => ({
      id: i.id,
      account_identifier: i.account_identifier,
    })),
  });
}

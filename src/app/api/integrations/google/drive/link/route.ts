import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: {
    crm_customer_id: string;
    integration_id: string;
    folder_id: string;
    folder_name: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { crm_customer_id, integration_id, folder_id, folder_name } = body;

  if (!crm_customer_id || !integration_id || !folder_id || !folder_name) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: crm_customer_id, integration_id, folder_id, folder_name",
      },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  // Validate integration ownership
  const { data: integration } = await admin
    .from("integrations")
    .select("id")
    .eq("id", integration_id)
    .eq("user_id", user.id)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  // Validate crm_customer belongs to user's active client
  const { data: customer } = await admin
    .from("crm_customers")
    .select("id, client_id")
    .eq("id", crm_customer_id)
    .single();

  if (!customer) {
    return NextResponse.json(
      { error: "CRM customer not found" },
      { status: 404 },
    );
  }

  // Check the client belongs to the user
  const { data: clientAccess } = await admin
    .from("clients")
    .select("id")
    .eq("id", customer.client_id)
    .single();

  if (!clientAccess) {
    return NextResponse.json(
      { error: "CRM customer not accessible" },
      { status: 403 },
    );
  }

  const { data, error } = await admin
    .from("crm_drive_folders")
    .insert({
      crm_customer_id,
      integration_id,
      folder_id,
      folder_name,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Folder already linked" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

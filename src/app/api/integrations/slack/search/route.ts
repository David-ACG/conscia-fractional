import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { decrypt } from "@/lib/encryption";
import { WebClient } from "@slack/web-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const integrationId = searchParams.get("integration_id");
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const perPage = parseInt(searchParams.get("per_page") ?? "20", 10);
  const channelName = searchParams.get("channel_name") ?? undefined;

  if (!q || !integrationId) {
    return NextResponse.json(
      { error: "Missing required params: q, integration_id" },
      { status: 400 },
    );
  }

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

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 },
    );
  }

  // Verify user owns integration
  const { data: integration } = await admin
    .from("integrations")
    .select("id, metadata")
    .eq("id", integrationId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!integration) {
    return NextResponse.json(
      { error: "Integration not found" },
      { status: 404 },
    );
  }

  const userTokenEncrypted = (integration.metadata as Record<string, unknown>)
    ?.user_token_encrypted as string | undefined;

  if (!userTokenEncrypted) {
    return NextResponse.json(
      { error: "No user token available for search" },
      { status: 400 },
    );
  }

  try {
    const userToken = decrypt(userTokenEncrypted);
    const client = new WebClient(userToken);

    const fullQuery = channelName ? `in:#${channelName} ${q}` : q;

    const response = await client.search.messages({
      query: fullQuery,
      count: perPage,
      page,
    });

    if (!response.ok) {
      throw new Error(`search.messages failed: ${response.error ?? "unknown"}`);
    }

    const matches = response.messages?.matches ?? [];
    const total = response.messages?.total ?? 0;
    const totalPages = response.messages?.paging?.pages ?? 1;
    const hasMore = page < totalPages;

    const messages = matches
      .filter((m) => m.ts && m.text)
      .map((m) => ({
        ts: m.ts!,
        user: m.user ?? "",
        user_name: m.username,
        text: m.text!,
        permalink: m.permalink,
        channel_name: (
          m as Record<string, unknown> & { channel?: { name?: string } }
        ).channel?.name,
      }));

    return NextResponse.json({ messages, total, page, has_more: hasMore });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

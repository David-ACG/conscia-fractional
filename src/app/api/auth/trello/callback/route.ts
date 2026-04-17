import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  fetchMemberInfo,
  storeCredentials,
} from "@/lib/services/trello-auth-service";

const SETTINGS_URL = "/settings";

const FRAGMENT_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Connecting Trello…</title></head>
<body><p>Connecting Trello…</p>
<script>
(function() {
  var p = new URLSearchParams(location.hash.slice(1));
  var t = p.get('token');
  if (t) {
    location.href = location.pathname + '?token=' + encodeURIComponent(t);
  } else {
    location.href = '/settings?trello=error&message=no_token';
  }
})();
</script>
</body></html>`;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse(FRAGMENT_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  const cookieStore = await cookies();
  const apiKey = cookieStore.get("trello_pending_key")?.value;

  if (!apiKey) {
    return NextResponse.redirect(
      new URL(`${SETTINGS_URL}?trello=error&message=key_missing`, request.url),
    );
  }

  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let username: string;
  try {
    const memberInfo = await fetchMemberInfo(apiKey, token);
    username = memberInfo.username;
  } catch {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?trello=error&message=trello_rejected`,
        request.url,
      ),
    );
  }

  try {
    await storeCredentials(user.id, apiKey, token, username);
  } catch {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?trello=error&message=store_failed`,
        request.url,
      ),
    );
  }

  const response = NextResponse.redirect(
    new URL(`${SETTINGS_URL}?trello=connected`, request.url),
  );
  response.cookies.delete("trello_pending_key");
  return response;
}

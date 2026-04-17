import { NextRequest, NextResponse } from "next/server";
import { buildAuthorizeUrl } from "@/lib/services/trello-auth-service";

const SETTINGS_URL = "/settings";
const API_KEY_REGEX = /^[a-f0-9]{32}$/i;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const apiKey = formData.get("apiKey");

  if (typeof apiKey !== "string" || !API_KEY_REGEX.test(apiKey)) {
    return NextResponse.redirect(
      new URL(
        `${SETTINGS_URL}?trello=error&message=invalid_key`,
        request.url,
      ),
      303,
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3002";
  const returnUrl = `${siteUrl}/api/auth/trello/callback`;

  const authorizeUrl = buildAuthorizeUrl(apiKey, returnUrl);

  const response = NextResponse.redirect(authorizeUrl, 303);
  response.cookies.set("trello_pending_key", apiKey, {
    httpOnly: true,
    maxAge: 600,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}

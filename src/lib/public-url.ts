const FALLBACK_ORIGIN = "http://localhost:3002";

function firstHeaderValue(value: string | null): string | null {
  return (
    value
      ?.split(",")
      .map((part) => part.trim())
      .find(Boolean) ?? null
  );
}

function isWildcardHostname(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  return normalized === "0.0.0.0" || normalized === "::";
}

function normalizeOrigin(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const candidate = trimmed.includes("://") ? trimmed : `http://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (isWildcardHostname(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicOrigin(request: Request): string {
  const configured = normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  if (configured) return configured;

  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host"),
  );
  const host = forwardedHost ?? firstHeaderValue(request.headers.get("host"));
  const proto =
    firstHeaderValue(request.headers.get("x-forwarded-proto")) ??
    requestUrl.protocol.replace(":", "") ??
    "http";

  const forwardedOrigin = host ? normalizeOrigin(`${proto}://${host}`) : null;
  return (
    forwardedOrigin ?? normalizeOrigin(requestUrl.origin) ?? FALLBACK_ORIGIN
  );
}

export function getSafeRedirectPath(
  value: string | null,
  fallback: `/${string}`,
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, FALLBACK_ORIGIN);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

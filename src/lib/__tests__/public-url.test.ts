import { afterEach, describe, expect, it } from "vitest";
import { getPublicOrigin, getSafeRedirectPath } from "@/lib/public-url";

const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

afterEach(() => {
  if (originalSiteUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SITE_URL;
  } else {
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  }
});

describe("public URL helpers", () => {
  it("uses the configured site URL ahead of proxy headers", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://fractionalbuddy.local";

    const request = new Request("http://0.0.0.0:3002/auth/callback", {
      headers: {
        "x-forwarded-host": "internal-container:3002",
        "x-forwarded-proto": "http",
      },
    });

    expect(getPublicOrigin(request)).toBe("http://fractionalbuddy.local");
  });

  it("uses forwarded host headers when no site URL is configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const request = new Request("http://0.0.0.0:3002/auth/callback", {
      headers: {
        "x-forwarded-host": "fractionalbuddy.local",
        "x-forwarded-proto": "http",
      },
    });

    expect(getPublicOrigin(request)).toBe("http://fractionalbuddy.local");
  });

  it("normalizes wildcard bind hosts to localhost", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;

    const request = new Request("http://0.0.0.0:3002/auth/callback");

    expect(getPublicOrigin(request)).toBe("http://localhost:3002");
  });

  it("keeps redirect paths local to the app", () => {
    expect(getSafeRedirectPath("/dashboard?tab=home", "/dashboard")).toBe(
      "/dashboard?tab=home",
    );
    expect(getSafeRedirectPath("https://example.com", "/dashboard")).toBe(
      "/dashboard",
    );
    expect(getSafeRedirectPath("//example.com", "/dashboard")).toBe(
      "/dashboard",
    );
  });
});

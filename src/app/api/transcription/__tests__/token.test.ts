import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// Mock Supabase server client
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock transcription service
const mockCreateTemporaryApiKey = vi.fn();
vi.mock("@/lib/services/transcription-service", () => ({
  createTemporaryApiKey: (...args: unknown[]) =>
    mockCreateTemporaryApiKey(...args),
}));

describe("POST /api/transcription/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPGRAM_API_KEY = "test-key";
  });

  it("returns 200 with key and expiresAt for authenticated user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const expiresAt = new Date("2026-04-01T12:01:00Z");
    mockCreateTemporaryApiKey.mockResolvedValue({
      key: "temp-key-123",
      expiresAt,
    });

    const { POST } = await import("@/app/api/transcription/token/route");

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.key).toBe("temp-key-123");
    expect(data.expiresAt).toBe("2026-04-01T12:01:00.000Z");
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { POST } = await import("@/app/api/transcription/token/route");

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });

  it("returns 500 when DEEPGRAM_API_KEY is not set", async () => {
    delete process.env.DEEPGRAM_API_KEY;

    vi.resetModules();

    // Re-mock after reset
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: vi.fn(async () => ({
        auth: { getUser: mockGetUser },
      })),
    }));
    vi.doMock("@/lib/services/transcription-service", () => ({
      createTemporaryApiKey: mockCreateTemporaryApiKey,
    }));

    const { POST } = await import("@/app/api/transcription/token/route");

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Deepgram API key not configured");
  });

  it("returns 500 when Deepgram API fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockCreateTemporaryApiKey.mockRejectedValue(
      new Error("Deepgram API error"),
    );

    const { POST } = await import("@/app/api/transcription/token/route");

    const response = await POST();
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Deepgram API error");
  });
});

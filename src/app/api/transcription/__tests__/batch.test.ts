import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase server client
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Mock transcription service
const mockTranscribeBatch = vi.fn();
vi.mock("@/lib/services/transcription-service", () => ({
  transcribeBatch: (...args: unknown[]) => mockTranscribeBatch(...args),
}));

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3002/api/transcription/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/transcription/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPGRAM_API_KEY = "test-key";
  });

  it("returns 200 with segments, speakers, and durationMs", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const segments = [
      {
        text: "Hello",
        startMs: 0,
        endMs: 1500,
        speaker: "Speaker 1",
        confidence: 0.95,
      },
      {
        text: "Hi there",
        startMs: 1600,
        endMs: 3000,
        speaker: "Speaker 2",
        confidence: 0.88,
      },
    ];
    mockTranscribeBatch.mockResolvedValue(segments);

    const { POST } = await import("@/app/api/transcription/batch/route");

    const response = await POST(
      makeRequest({ audioUrl: "https://example.com/audio.mp3" }),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.segments).toHaveLength(2);
    expect(data.speakers).toEqual(["Speaker 1", "Speaker 2"]);
    expect(data.durationMs).toBe(3000);
  });

  it("returns 400 when audioUrl is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const { POST } = await import("@/app/api/transcription/batch/route");

    const response = await POST(makeRequest({}));
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("audioUrl is required");
  });

  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const { POST } = await import("@/app/api/transcription/batch/route");

    const response = await POST(
      makeRequest({ audioUrl: "https://example.com/audio.mp3" }),
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Not authenticated");
  });

  it("returns 500 when transcription fails", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockTranscribeBatch.mockRejectedValue(
      new Error("Transcription service error"),
    );

    const { POST } = await import("@/app/api/transcription/batch/route");

    const response = await POST(
      makeRequest({ audioUrl: "https://example.com/audio.mp3" }),
    );
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe("Transcription service error");
  });

  it("passes config to transcribeBatch", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });
    mockTranscribeBatch.mockResolvedValue([]);

    const { POST } = await import("@/app/api/transcription/batch/route");

    await POST(
      makeRequest({
        audioUrl: "https://example.com/audio.mp3",
        config: { model: "nova-2", language: "de" },
      }),
    );

    expect(mockTranscribeBatch).toHaveBeenCalledWith(
      "https://example.com/audio.mp3",
      { model: "nova-2", language: "de" },
    );
  });
});

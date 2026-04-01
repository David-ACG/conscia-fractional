import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock next/headers (required by server.ts)
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => ({ name: "fb_client_id", value: "client-123" })),
    set: vi.fn(),
    getAll: vi.fn(() => []),
  })),
}));

// Mock Supabase server client (for auth)
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
  ),
}));

// Mock getActiveClientId
vi.mock("@/lib/actions/clients", () => ({
  getActiveClientId: vi.fn(() => Promise.resolve("client-123")),
}));

// Mock processRecording service
const mockProcessRecording = vi.fn();
vi.mock("@/lib/services/recording-service", () => ({
  processRecording: (...args: unknown[]) => mockProcessRecording(...args),
}));

describe("processRecordingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc" } },
    });
    mockProcessRecording.mockResolvedValue({
      meetingId: "meeting-123",
      title: "Test Meeting",
      summary: "Summary",
      tasks: [],
      timeEntryId: "te-123",
      audioUrl: "https://example.com/audio.webm",
    });
  });

  it("returns meetingId on success", async () => {
    const { processRecordingAction } = await import("../recording");

    const formData = new FormData();
    formData.append("segments", JSON.stringify([]));
    formData.append(
      "audio",
      new Blob(["audio"], { type: "audio/webm" }),
      "recording.webm",
    );
    formData.append("duration", "120");

    const result = await processRecordingAction(formData);

    expect(result).toEqual({ meetingId: "meeting-123" });
    expect(mockProcessRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-123",
        userId: "user-abc",
        durationSeconds: 120,
      }),
    );
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { processRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audio", new Blob(["audio"]), "recording.webm");
    formData.append("duration", "60");

    const result = await processRecordingAction(formData);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when segments JSON is invalid", async () => {
    const { processRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "not-valid-json");
    formData.append("audio", new Blob(["audio"]), "recording.webm");
    formData.append("duration", "60");

    const result = await processRecordingAction(formData);
    expect(result).toEqual({ error: "Invalid segments data" });
  });

  it("returns error when processRecording throws", async () => {
    mockProcessRecording.mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );

    const { processRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audio", new Blob(["audio"]), "recording.webm");
    formData.append("duration", "60");

    const result = await processRecordingAction(formData);
    expect(result).toEqual({ error: "Storage unavailable" });
  });

  it("returns error when audio file is missing", async () => {
    const { processRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("duration", "60");
    // No audio field

    const result = await processRecordingAction(formData);
    expect(result).toEqual({ error: "Missing audio file" });
  });
});

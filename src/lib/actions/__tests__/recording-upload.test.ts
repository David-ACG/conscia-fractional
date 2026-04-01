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

// Mock recording service
const mockProcessRecording = vi.fn();
const mockProcessUploadedRecording = vi.fn();
vi.mock("@/lib/services/recording-service", () => ({
  processRecording: (...args: unknown[]) => mockProcessRecording(...args),
  processUploadedRecording: (...args: unknown[]) =>
    mockProcessUploadedRecording(...args),
}));

const MOCK_RESULT = {
  meetingId: "meeting-456",
  title: "Uploaded Meeting",
  summary: "Summary of uploaded meeting",
  tasks: [],
  timeEntryId: "te-456",
  audioUrl: "https://storage.example.com/signed/audio.mp3",
};

describe("processUploadedRecordingAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-abc" } },
    });
    mockProcessUploadedRecording.mockResolvedValue(MOCK_RESULT);
  });

  it("returns meetingId on success", async () => {
    const { processUploadedRecordingAction } = await import("../recording");

    const formData = new FormData();
    formData.append("segments", JSON.stringify([]));
    formData.append("audioUrl", "https://storage.example.com/signed/audio.mp3");
    formData.append("duration", "180");
    formData.append("fileName", "meeting.mp3");

    const result = await processUploadedRecordingAction(formData);

    expect(result).toEqual({ meetingId: "meeting-456" });
    expect(mockProcessUploadedRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-123",
        userId: "user-abc",
        durationSeconds: 180,
        audioUrl: "https://storage.example.com/signed/audio.mp3",
        fileName: "meeting.mp3",
      }),
    );
  });

  it("returns error when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });

    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "60");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Not authenticated" });
  });

  it("returns error when segments is missing", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "60");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Missing segments data" });
  });

  it("returns error when audioUrl is missing", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("duration", "60");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Missing audio URL" });
  });

  it("returns error when duration is missing", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Missing duration" });
  });

  it("returns error for invalid segments JSON", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "not-json");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "60");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Invalid segments data" });
  });

  it("returns error for invalid duration", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "not-a-number");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Invalid duration" });
  });

  it("returns error when processUploadedRecording throws", async () => {
    mockProcessUploadedRecording.mockRejectedValueOnce(
      new Error("Claude API unavailable"),
    );

    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "60");

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ error: "Claude API unavailable" });
  });

  it("works without optional fileName field", async () => {
    const { processUploadedRecordingAction } = await import("../recording");
    const formData = new FormData();
    formData.append("segments", "[]");
    formData.append("audioUrl", "https://storage.example.com/audio.mp3");
    formData.append("duration", "90");
    // No fileName

    const result = await processUploadedRecordingAction(formData);
    expect(result).toEqual({ meetingId: "meeting-456" });
    expect(mockProcessUploadedRecording).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: undefined,
      }),
    );
  });
});

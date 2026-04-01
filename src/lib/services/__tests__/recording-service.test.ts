import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase admin
const mockStorageUpload = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageFrom = vi.fn(() => ({
  upload: mockStorageUpload,
  createSignedUrl: mockStorageCreateSignedUrl,
}));

const mockSingle = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: mockFrom,
    storage: { from: mockStorageFrom },
  })),
}));

// Mock transcript extraction service
const mockExtractMeetingData = vi.fn();
vi.mock("@/lib/services/transcript-extraction-service", () => ({
  extractMeetingData: (...args: unknown[]) => mockExtractMeetingData(...args),
}));

import { parseTranscript } from "@/lib/transcript-parser";
import type { TranscriptSegment } from "@/lib/types/transcription";

describe("recording-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingle.mockResolvedValue({ data: { id: "meeting-123" }, error: null });
    mockEq.mockReturnValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-url" },
      error: null,
    });
    mockExtractMeetingData.mockResolvedValue({
      title: "Test Meeting",
      summary: "## Summary\n- Key point",
      tasks: [
        {
          title: "Follow up on deployment",
          description: "Check deployment status",
          priority: "high",
          assignee: "David",
          assignee_type: "self",
          confidence: "explicit",
          source_quote: "We need to follow up on deployment",
        },
      ],
      metadata: {
        durationMinutes: 30,
        speakers: ["Speaker 1"],
        meetingDate: null,
      },
    });
    // Time entry insert
    const mockTimeInsert = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi
          .fn()
          .mockResolvedValue({ data: { id: "te-123" }, error: null }),
      })),
    }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "time_entries") {
        return { insert: mockTimeInsert };
      }
      return {
        insert: mockInsert,
        update: mockUpdate,
        select: mockSelect,
      };
    });
  });

  describe("segmentsToSrt", () => {
    it("converts segments to SRT format", async () => {
      const { segmentsToSrt } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Hello world",
          startMs: 0,
          endMs: 2500,
          speaker: "Speaker 1",
          confidence: 0.95,
        },
        {
          text: "How are you?",
          startMs: 3000,
          endMs: 5000,
          speaker: "Speaker 2",
          confidence: 0.9,
        },
      ];

      const srt = segmentsToSrt(segments);

      expect(srt).toContain("00:00:00,000 --> 00:00:02,500 [Speaker 1]");
      expect(srt).toContain("Hello world");
      expect(srt).toContain("00:00:03,000 --> 00:00:05,000 [Speaker 2]");
      expect(srt).toContain("How are you?");
    });

    it("formats HH:MM:SS,mmm timestamps correctly for large values", async () => {
      const { segmentsToSrt } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Late segment",
          startMs: 3_661_500,
          endMs: 3_665_000,
          speaker: "Speaker 1",
          confidence: 0.9,
        },
      ];

      const srt = segmentsToSrt(segments);
      // 3661500ms = 1h 1m 1.5s
      expect(srt).toContain("01:01:01,500 --> 01:01:05,000 [Speaker 1]");
    });

    it("roundtrips correctly through parseTranscript", async () => {
      const { segmentsToSrt } = await import("../recording-service");

      const original: TranscriptSegment[] = [
        {
          text: "Hello world",
          startMs: 240,
          endMs: 2540,
          speaker: "Sana",
          confidence: 0.95,
        },
        {
          text: "Great to be here.",
          startMs: 3000,
          endMs: 5200,
          speaker: "David",
          confidence: 0.92,
        },
        {
          text: "Let us begin.",
          startMs: 6000,
          endMs: 8500,
          speaker: "Sana",
          confidence: 0.88,
        },
      ];

      const srt = segmentsToSrt(original);
      const parsed = parseTranscript(srt);

      expect(parsed.segments).toHaveLength(3);
      expect(parsed.segments[0]!.speaker).toBe("Sana");
      expect(parsed.segments[0]!.text).toBe("Hello world");
      expect(parsed.segments[0]!.startMs).toBe(240);
      expect(parsed.segments[0]!.endMs).toBe(2540);
      expect(parsed.segments[1]!.speaker).toBe("David");
      expect(parsed.segments[1]!.text).toBe("Great to be here.");
      expect(parsed.segments[2]!.speaker).toBe("Sana");
      expect(parsed.speakers).toEqual(
        expect.arrayContaining(["Sana", "David"]),
      );
    });

    it("handles empty segments array", async () => {
      const { segmentsToSrt } = await import("../recording-service");
      const srt = segmentsToSrt([]);
      expect(srt).toBe("");
    });
  });

  describe("uploadAudio", () => {
    it("uploads to correct path and returns signed URL", async () => {
      const { uploadAudio } = await import("../recording-service");

      const blob = new Blob(["audio-data"], { type: "audio/webm" });
      const url = await uploadAudio(blob, "user-abc", "meeting-123");

      expect(mockStorageFrom).toHaveBeenCalledWith("meeting-recordings");
      expect(mockStorageUpload).toHaveBeenCalledWith(
        "user-abc/meeting-123/recording.webm",
        blob,
        expect.objectContaining({ contentType: "audio/webm" }),
      );
      expect(url).toBe("https://example.com/signed-url");
    });

    it("throws on upload error", async () => {
      mockStorageUpload.mockResolvedValueOnce({
        error: { message: "Upload failed" },
      });

      const { uploadAudio } = await import("../recording-service");
      const blob = new Blob(["audio"], { type: "audio/webm" });

      await expect(
        uploadAudio(blob, "user-abc", "meeting-123"),
      ).rejects.toThrow("Audio upload failed");
    });
  });

  describe("processRecording", () => {
    it("creates meeting, uploads audio, extracts data, creates time entry", async () => {
      const { processRecording } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Let us discuss the project.",
          startMs: 0,
          endMs: 3000,
          speaker: "Speaker 1",
          confidence: 0.95,
        },
      ];
      const audioBlob = new Blob(["audio"], { type: "audio/webm" });

      const result = await processRecording({
        segments,
        audioBlob,
        durationSeconds: 120,
        userId: "user-abc",
        clientId: "client-123",
      });

      expect(result.meetingId).toBe("meeting-123");
      expect(result.title).toBe("Test Meeting");
      expect(result.audioUrl).toBe("https://example.com/signed-url");
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.title).toBe("Follow up on deployment");
    });

    it("rounds duration up to nearest 15 minutes", async () => {
      const { processRecording } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Quick sync.",
          startMs: 0,
          endMs: 5000,
          speaker: "Speaker 1",
          confidence: 0.9,
        },
      ];
      const audioBlob = new Blob(["audio"], { type: "audio/webm" });

      // 7 minutes → rounds up to 15
      await processRecording({
        segments,
        audioBlob,
        durationSeconds: 420,
        userId: "user-abc",
        clientId: "client-123",
      });

      expect(mockFrom).toHaveBeenCalledWith("meetings");
      const insertCall = mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.duration_minutes).toBe(15);
    });

    it("passes crm_customer_id when provided", async () => {
      const { processRecording } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Customer discussion.",
          startMs: 0,
          endMs: 3000,
          speaker: "Speaker 1",
          confidence: 0.9,
        },
      ];
      const audioBlob = new Blob(["audio"], { type: "audio/webm" });

      await processRecording({
        segments,
        audioBlob,
        durationSeconds: 60,
        userId: "user-abc",
        clientId: "client-123",
        crmCustomerId: "crm-456",
      });

      const insertCall = mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.crm_customer_id).toBe("crm-456");
    });

    it("extracts unique speakers as attendees", async () => {
      const { processRecording } = await import("../recording-service");

      const segments: TranscriptSegment[] = [
        {
          text: "Hi there.",
          startMs: 0,
          endMs: 1000,
          speaker: "Alice",
          confidence: 0.9,
        },
        {
          text: "Hello Alice.",
          startMs: 1500,
          endMs: 2500,
          speaker: "Bob",
          confidence: 0.9,
        },
        {
          text: "Great to meet you.",
          startMs: 3000,
          endMs: 4000,
          speaker: "Alice",
          confidence: 0.9,
        },
      ];
      const audioBlob = new Blob(["audio"], { type: "audio/webm" });

      await processRecording({
        segments,
        audioBlob,
        durationSeconds: 60,
        userId: "user-abc",
        clientId: "client-123",
      });

      const insertCall = mockInsert.mock.calls[0]?.[0];
      expect(insertCall?.attendees).toEqual(
        expect.arrayContaining([{ name: "Alice" }, { name: "Bob" }]),
      );
      expect(insertCall?.attendees).toHaveLength(2);
    });
  });
});

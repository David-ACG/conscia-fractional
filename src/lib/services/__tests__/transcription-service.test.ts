import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Deepgram SDK
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockTranscribeUrl = vi.fn();
const mockTranscribeFile = vi.fn();

vi.mock("@deepgram/sdk", () => {
  return {
    DeepgramClient: class MockDeepgramClient {
      manage = {
        v1: {
          projects: {
            list: mockList,
            keys: { create: mockCreate },
          },
        },
      };
      listen = {
        v1: {
          media: {
            transcribeUrl: mockTranscribeUrl,
            transcribeFile: mockTranscribeFile,
          },
        },
      };
    },
  };
});

describe("transcription-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPGRAM_API_KEY = "test-api-key";
  });

  describe("deepgramResponseToSegments", () => {
    it("converts Deepgram utterances to TranscriptSegment[]", async () => {
      const { deepgramResponseToSegments } =
        await import("@/lib/services/transcription-service");

      const utterances = [
        {
          start: 0.5,
          end: 2.3,
          confidence: 0.95,
          transcript: "Hello, how are you?",
          speaker: 0,
          words: [
            {
              word: "Hello",
              start: 0.5,
              end: 0.8,
              confidence: 0.98,
              speaker: 0,
            },
          ],
        },
        {
          start: 2.5,
          end: 4.1,
          confidence: 0.88,
          transcript: "I'm doing well, thanks.",
          speaker: 1,
          words: [
            { word: "I'm", start: 2.5, end: 2.7, confidence: 0.9, speaker: 1 },
          ],
        },
      ];

      const segments = deepgramResponseToSegments(utterances);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        text: "Hello, how are you?",
        startMs: 500,
        endMs: 2300,
        speaker: "Speaker 1",
        confidence: 0.95,
      });
      expect(segments[1]).toEqual({
        text: "I'm doing well, thanks.",
        startMs: 2500,
        endMs: 4100,
        speaker: "Speaker 2",
        confidence: 0.88,
      });
    });

    it("handles missing optional fields with defaults", async () => {
      const { deepgramResponseToSegments } =
        await import("@/lib/services/transcription-service");

      const utterances = [{ words: [] }];
      const segments = deepgramResponseToSegments(utterances);

      expect(segments[0]).toEqual({
        text: "",
        startMs: 0,
        endMs: 0,
        speaker: "Speaker 1",
        confidence: 0,
      });
    });

    it("maps multiple speakers correctly", async () => {
      const { deepgramResponseToSegments } =
        await import("@/lib/services/transcription-service");

      const utterances = [
        { transcript: "A", speaker: 0, start: 0, end: 1, confidence: 0.9 },
        { transcript: "B", speaker: 2, start: 1, end: 2, confidence: 0.85 },
        { transcript: "C", speaker: 1, start: 2, end: 3, confidence: 0.92 },
      ];

      const segments = deepgramResponseToSegments(utterances);
      expect(segments[0]!.speaker).toBe("Speaker 1");
      expect(segments[1]!.speaker).toBe("Speaker 3");
      expect(segments[2]!.speaker).toBe("Speaker 2");
    });
  });

  describe("createTemporaryApiKey", () => {
    it("returns key and expiry date", async () => {
      mockList.mockResolvedValue({
        projects: [{ projectId: "proj-123" }],
      });
      mockCreate.mockResolvedValue({
        key: "temp-key-abc",
      });

      const { createTemporaryApiKey } =
        await import("@/lib/services/transcription-service");

      const result = await createTemporaryApiKey();

      expect(result.key).toBe("temp-key-abc");
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(mockCreate).toHaveBeenCalledWith(
        "proj-123",
        expect.objectContaining({
          comment: "Temporary browser streaming key",
          scopes: ["usage:write"],
        }),
      );
    });

    it("throws when no projects found", async () => {
      mockList.mockResolvedValue({ projects: [] });

      const { createTemporaryApiKey } =
        await import("@/lib/services/transcription-service");

      await expect(createTemporaryApiKey()).rejects.toThrow(
        "No Deepgram projects found",
      );
    });

    it("throws when API key creation fails", async () => {
      mockList.mockResolvedValue({
        projects: [{ projectId: "proj-123" }],
      });
      mockCreate.mockResolvedValue({ key: undefined });

      const { createTemporaryApiKey } =
        await import("@/lib/services/transcription-service");

      await expect(createTemporaryApiKey()).rejects.toThrow(
        "Failed to create temporary API key",
      );
    });
  });

  describe("transcribeBatch", () => {
    it("converts Deepgram response to TranscriptSegment[]", async () => {
      mockTranscribeUrl.mockResolvedValue({
        results: {
          utterances: [
            {
              start: 1.0,
              end: 3.5,
              confidence: 0.92,
              transcript: "Test utterance",
              speaker: 0,
              words: [],
            },
          ],
        },
      });

      const { transcribeBatch } =
        await import("@/lib/services/transcription-service");

      const segments = await transcribeBatch("https://example.com/audio.mp3");

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        text: "Test utterance",
        startMs: 1000,
        endMs: 3500,
        speaker: "Speaker 1",
        confidence: 0.92,
      });

      expect(mockTranscribeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "https://example.com/audio.mp3",
          model: "nova-3",
          diarize: true,
          utterances: true,
        }),
      );
    });

    it("returns empty array when no utterances", async () => {
      mockTranscribeUrl.mockResolvedValue({
        results: { utterances: undefined },
      });

      const { transcribeBatch } =
        await import("@/lib/services/transcription-service");

      const segments = await transcribeBatch("https://example.com/audio.mp3");
      expect(segments).toEqual([]);
    });

    it("uses custom config when provided", async () => {
      mockTranscribeUrl.mockResolvedValue({
        results: { utterances: [] },
      });

      const { transcribeBatch } =
        await import("@/lib/services/transcription-service");

      await transcribeBatch("https://example.com/audio.mp3", {
        model: "nova-2",
        language: "de",
      });

      expect(mockTranscribeUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "nova-2",
          language: "de",
        }),
      );
    });
  });

  describe("transcribeBatchFromBuffer", () => {
    it("works with buffer input", async () => {
      mockTranscribeFile.mockResolvedValue({
        results: {
          utterances: [
            {
              start: 0,
              end: 1.5,
              confidence: 0.9,
              transcript: "Buffer test",
              speaker: 0,
              words: [],
            },
          ],
        },
      });

      const { transcribeBatchFromBuffer } =
        await import("@/lib/services/transcription-service");

      const buffer = Buffer.from("fake-audio-data");
      const segments = await transcribeBatchFromBuffer(buffer, "audio/wav");

      expect(segments).toHaveLength(1);
      expect(segments[0]!.text).toBe("Buffer test");
      expect(mockTranscribeFile).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("throws when DEEPGRAM_API_KEY is not set", async () => {
      delete process.env.DEEPGRAM_API_KEY;

      // Need fresh import to pick up env change
      vi.resetModules();

      // Re-mock after reset
      vi.doMock("@deepgram/sdk", () => ({
        DeepgramClient: vi.fn(() => {
          throw new Error("should not be called");
        }),
      }));

      const { transcribeBatch } =
        await import("@/lib/services/transcription-service");

      await expect(
        transcribeBatch("https://example.com/audio.mp3"),
      ).rejects.toThrow("DEEPGRAM_API_KEY environment variable is not set");
    });
  });
});

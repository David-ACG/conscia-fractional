import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock @anthropic-ai/sdk
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class MockAnthropic {
      messages = { create: mockCreate };
      constructor(_opts: unknown) {}
    },
  };
});

// Mock transcript parser
vi.mock("@/lib/transcript-parser", () => ({
  parseTranscript: vi.fn(() => ({
    durationMinutes: 30,
    speakers: ["Speaker 1", "Speaker 2"],
    segments: [],
    fullText: "[Speaker 1]: Hello world\n[Speaker 2]: Hi there",
  })),
  parseDateFromFilename: vi.fn(() => null),
}));

describe("transcript-extraction-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-api-key";

    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({
            title: "Q1 Planning Meeting",
            summary: "## Summary\n- Discussed Q1 goals",
            tasks: [
              {
                title: "Create roadmap",
                description: "Detailed roadmap for Q1",
                priority: "high",
                assignee: "David",
                assignee_type: "self",
                confidence: "explicit",
                source_quote: "We need a roadmap by Friday",
              },
            ],
          }),
        },
      ],
    });
  });

  describe("extractMeetingData", () => {
    it("returns structured extraction result", async () => {
      const { extractMeetingData } =
        await import("../transcript-extraction-service");

      const result = await extractMeetingData(
        "00:00:00,000 --> 00:00:05,000 [Speaker 1]\nHello world\n",
      );

      expect(result.title).toBe("Q1 Planning Meeting");
      expect(result.summary).toContain("Q1 goals");
      expect(result.tasks).toHaveLength(1);
      expect(result.tasks[0]!.title).toBe("Create roadmap");
      expect(result.tasks[0]!.priority).toBe("high");
      expect(result.metadata.speakers).toEqual(["Speaker 1", "Speaker 2"]);
      expect(result.metadata.durationMinutes).toBe(30);
    });

    it("handles Claude response wrapped in code block", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text:
              "```json\n" +
              JSON.stringify({
                title: "Wrapped response",
                summary: "Summary",
                tasks: [],
              }) +
              "\n```",
          },
        ],
      });

      const { extractMeetingData } =
        await import("../transcript-extraction-service");
      const result = await extractMeetingData("some transcript");

      expect(result.title).toBe("Wrapped response");
      expect(result.tasks).toEqual([]);
    });

    it("throws when ANTHROPIC_API_KEY is not set", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      vi.resetModules();
      vi.doMock("@anthropic-ai/sdk", () => ({
        default: class {
          messages = { create: mockCreate };
        },
      }));
      vi.doMock("@/lib/transcript-parser", () => ({
        parseTranscript: vi.fn(() => ({
          durationMinutes: 0,
          speakers: [],
          segments: [],
          fullText: "",
        })),
        parseDateFromFilename: vi.fn(() => null),
      }));

      const { extractMeetingData } =
        await import("../transcript-extraction-service");
      await expect(extractMeetingData("transcript")).rejects.toThrow(
        "ANTHROPIC_API_KEY not configured",
      );
    });

    it("throws when Claude returns no text block", async () => {
      mockCreate.mockResolvedValueOnce({ content: [] });

      const { extractMeetingData } =
        await import("../transcript-extraction-service");
      await expect(extractMeetingData("transcript")).rejects.toThrow(
        "No response from AI",
      );
    });

    it("throws when Claude returns malformed JSON", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "not valid json {{" }],
      });

      const { extractMeetingData } =
        await import("../transcript-extraction-service");
      await expect(extractMeetingData("transcript")).rejects.toThrow(
        "Failed to parse AI response",
      );
    });

    it("passes filename to parseDateFromFilename when provided", async () => {
      const { parseDateFromFilename } = await import("@/lib/transcript-parser");
      const { extractMeetingData } =
        await import("../transcript-extraction-service");

      await extractMeetingData(
        "transcript",
        "Client_-_test_-_27_Mar_at_15-31_eng.txt",
      );

      expect(parseDateFromFilename).toHaveBeenCalledWith(
        "Client_-_test_-_27_Mar_at_15-31_eng.txt",
      );
    });

    it("defaults tasks to empty array when missing from response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "No tasks meeting",
              summary: "Summary",
            }),
          },
        ],
      });

      const { extractMeetingData } =
        await import("../transcript-extraction-service");
      const result = await extractMeetingData("transcript");

      expect(result.tasks).toEqual([]);
    });
  });
});

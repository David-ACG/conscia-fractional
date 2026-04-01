import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";
import { LiveTranscript } from "../live-transcript";
import type { TranscriptSegment } from "@/lib/types/transcription";

const makeSegment = (
  speaker: string,
  text: string,
  startMs = 0,
  endMs = 1000,
): TranscriptSegment => ({ speaker, text, startMs, endMs, confidence: 0.9 });

describe("LiveTranscript", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders empty state with 'Waiting for speech...' when isLive and no segments", () => {
    render(
      <LiveTranscript segments={[]} onSegmentEdit={vi.fn()} isLive={true} />,
    );
    expect(screen.getByText("Waiting for speech...")).toBeInTheDocument();
  });

  it("renders empty state without animation text when not live", () => {
    render(
      <LiveTranscript segments={[]} onSegmentEdit={vi.fn()} isLive={false} />,
    );
    expect(screen.getByText("No transcript available.")).toBeInTheDocument();
    expect(screen.queryByText("Waiting for speech...")).not.toBeInTheDocument();
  });

  it("renders segments with speaker names, timestamps, and text", () => {
    const segments = [
      makeSegment("Speaker 1", "Hello everyone.", 0, 2000),
      makeSegment("Speaker 2", "Thanks for joining.", 3000, 6000),
    ];

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={vi.fn()}
        isLive={false}
      />,
    );

    expect(screen.getByText("Speaker 1")).toBeInTheDocument();
    expect(screen.getByText("Hello everyone.")).toBeInTheDocument();
    expect(screen.getByText("Speaker 2")).toBeInTheDocument();
    expect(screen.getByText("Thanks for joining.")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    expect(screen.getByText("00:03")).toBeInTheDocument();
  });

  it("formats timestamps as MM:SS", () => {
    const segments = [makeSegment("Speaker 1", "Text.", 65000, 70000)];

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={vi.fn()}
        isLive={false}
      />,
    );

    expect(screen.getByText("01:05")).toBeInTheDocument();
  });

  it("clicking speaker name shows inline input for editing", async () => {
    const segments = [makeSegment("Speaker 1", "Hello.", 0, 1000)];

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={vi.fn()}
        isLive={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Speaker 1"));
    });

    expect(screen.getByLabelText("Edit speaker name")).toBeInTheDocument();
  });

  it("committing speaker edit calls onSegmentEdit for all matching segments", async () => {
    const segments = [
      makeSegment("Speaker 1", "First.", 0, 1000),
      makeSegment("Speaker 2", "Second.", 2000, 3000),
      makeSegment("Speaker 1", "Third.", 4000, 5000),
    ];
    const onSegmentEdit = vi.fn();

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={onSegmentEdit}
        isLive={false}
      />,
    );

    // Click first Speaker 1
    await act(async () => {
      fireEvent.click(screen.getAllByText("Speaker 1")[0]);
    });

    const input = screen.getByLabelText("Edit speaker name");

    await act(async () => {
      fireEvent.change(input, { target: { value: "David" } });
      fireEvent.keyDown(input, { key: "Enter" });
    });

    // Should rename both segments with "Speaker 1" (indices 0 and 2)
    expect(onSegmentEdit).toHaveBeenCalledWith(0, "speaker", "David");
    expect(onSegmentEdit).toHaveBeenCalledWith(2, "speaker", "David");
    // Should NOT rename Speaker 2 (index 1)
    expect(onSegmentEdit).not.toHaveBeenCalledWith(1, "speaker", "David");
  });

  it("text is not editable during live mode", () => {
    const segments = [makeSegment("Speaker 1", "Hello.", 0, 1000)];

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={vi.fn()}
        isLive={true}
      />,
    );

    const textEl = screen.getByText("Hello.");
    expect(textEl).not.toHaveAttribute("title", "Click to edit");
  });

  it("clicking text in review mode shows inline textarea", async () => {
    const segments = [makeSegment("Speaker 1", "Hello.", 0, 1000)];

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={vi.fn()}
        isLive={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Hello."));
    });

    expect(screen.getByLabelText("Edit transcript text")).toBeInTheDocument();
  });

  it("committing text edit calls onSegmentEdit for the segment", async () => {
    const segments = [makeSegment("Speaker 1", "Hello.", 0, 1000)];
    const onSegmentEdit = vi.fn();

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={onSegmentEdit}
        isLive={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Hello."));
    });

    const textarea = screen.getByLabelText("Edit transcript text");

    await act(async () => {
      fireEvent.change(textarea, { target: { value: "Hello world." } });
      fireEvent.blur(textarea);
    });

    expect(onSegmentEdit).toHaveBeenCalledWith(0, "text", "Hello world.");
  });

  it("pressing Escape cancels speaker edit without calling onSegmentEdit", async () => {
    const segments = [makeSegment("Speaker 1", "Hello.", 0, 1000)];
    const onSegmentEdit = vi.fn();

    render(
      <LiveTranscript
        segments={segments}
        onSegmentEdit={onSegmentEdit}
        isLive={false}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Speaker 1"));
    });

    const input = screen.getByLabelText("Edit speaker name");

    await act(async () => {
      fireEvent.change(input, { target: { value: "New Name" } });
      fireEvent.keyDown(input, { key: "Escape" });
    });

    expect(onSegmentEdit).not.toHaveBeenCalled();
    expect(
      screen.queryByLabelText("Edit speaker name"),
    ).not.toBeInTheDocument();
  });
});

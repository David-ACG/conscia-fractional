import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
} from "@testing-library/react";

// Mock requestAnimationFrame / cancelAnimationFrame
vi.stubGlobal(
  "requestAnimationFrame",
  (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number,
);
vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

// Mock HTMLCanvasElement.getContext so canvas doesn't throw
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

// Mock checkAudioSupport
vi.mock("@/lib/browser-compat", () => ({
  checkAudioSupport: vi.fn(() => ({
    microphone: true,
    tabAudio: false,
    systemAudio: false,
    mediaRecorder: true,
    audioContext: true,
    warnings: [],
  })),
}));

// Mock useAudioCapture
const mockStartCapture = vi.fn().mockResolvedValue(undefined);
const mockStopCapture = vi
  .fn()
  .mockReturnValue(new Blob([], { type: "audio/webm" }));
const mockPauseCapture = vi.fn();
const mockResumeCapture = vi.fn();
const mockGetAudioChunks = vi.fn().mockReturnValue([]);

const mockAudioCaptureState = {
  isRecording: false,
  isPaused: false,
  duration: 0,
  audioLevel: 0,
  error: null,
  mediaRecorder: null,
  startCapture: mockStartCapture,
  stopCapture: mockStopCapture,
  pauseCapture: mockPauseCapture,
  resumeCapture: mockResumeCapture,
  getAudioChunks: mockGetAudioChunks,
};

vi.mock("@/hooks/use-audio-capture", () => ({
  useAudioCapture: vi.fn(() => mockAudioCaptureState),
}));

import { RecordingPanel } from "../recording-panel";
import { checkAudioSupport } from "@/lib/browser-compat";
import { useAudioCapture } from "@/hooks/use-audio-capture";

describe("RecordingPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAudioCapture).mockReturnValue({ ...mockAudioCaptureState });
    vi.mocked(checkAudioSupport).mockReturnValue({
      microphone: true,
      tabAudio: false,
      systemAudio: false,
      mediaRecorder: true,
      audioContext: true,
      warnings: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders in idle state with start button and microphone option", () => {
    const onAudioData = vi.fn();
    const onTranscriptUpdate = vi.fn();

    render(
      <RecordingPanel
        onAudioData={onAudioData}
        onTranscriptUpdate={onTranscriptUpdate}
      />,
    );

    expect(screen.getByLabelText("Start recording")).toBeInTheDocument();
    expect(screen.getByText("Microphone only")).toBeInTheDocument();
    expect(screen.getByText("Ready")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  it("shows tab audio option when tabAudio is supported", () => {
    vi.mocked(checkAudioSupport).mockReturnValue({
      microphone: true,
      tabAudio: true,
      systemAudio: false,
      mediaRecorder: true,
      audioContext: true,
      warnings: [],
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByText("Tab audio + Microphone")).toBeInTheDocument();
  });

  it("shows system audio option when systemAudio is supported", () => {
    vi.mocked(checkAudioSupport).mockReturnValue({
      microphone: true,
      tabAudio: false,
      systemAudio: true,
      mediaRecorder: true,
      audioContext: true,
      warnings: [],
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByText("System audio + Microphone")).toBeInTheDocument();
  });

  it("shows browser compatibility warning", () => {
    vi.mocked(checkAudioSupport).mockReturnValue({
      microphone: true,
      tabAudio: false,
      systemAudio: false,
      mediaRecorder: true,
      audioContext: true,
      warnings: ["Tab/system audio capture requires Chrome"],
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(
      screen.getByText("Tab/system audio capture requires Chrome"),
    ).toBeInTheDocument();
  });

  it("start button calls startCapture with microphone option", async () => {
    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    expect(mockStartCapture).toHaveBeenCalledWith({
      microphone: true,
      tabAudio: false,
      systemAudio: false,
    });
  });

  it("shows pause and stop buttons when recording", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: false,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByLabelText("Pause recording")).toBeInTheDocument();
    expect(screen.getByLabelText("Stop recording")).toBeInTheDocument();
    expect(screen.queryByLabelText("Start recording")).not.toBeInTheDocument();
  });

  it("pause button calls pauseCapture", async () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: false,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Pause recording"));
    });

    expect(mockPauseCapture).toHaveBeenCalledOnce();
  });

  it("resume button calls resumeCapture when paused", async () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: true,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Resume recording"));
    });

    expect(mockResumeCapture).toHaveBeenCalledOnce();
  });

  it("stop button calls onAudioData with chunks", async () => {
    const chunks = [new Blob(["audio"], { type: "audio/webm" })];
    mockGetAudioChunks.mockReturnValue(chunks);

    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: false,
      getAudioChunks: mockGetAudioChunks,
      stopCapture: mockStopCapture,
    });

    const onAudioData = vi.fn();

    render(
      <RecordingPanel onAudioData={onAudioData} onTranscriptUpdate={vi.fn()} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    expect(onAudioData).toHaveBeenCalledWith(chunks);
    expect(mockStopCapture).toHaveBeenCalledOnce();
  });

  it("shows duration in MM:SS format", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      duration: 75,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByText("01:15")).toBeInTheDocument();
  });

  it("shows Recording status badge when recording (Ready badge absent)", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: false,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    // Card title + status badge both say "Recording" when isRecording=true
    expect(screen.getAllByText("Recording")).toHaveLength(2);
    expect(screen.queryByText("Ready")).not.toBeInTheDocument();
  });

  it("shows Paused status badge when paused", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
      isPaused: true,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByText("Paused")).toBeInTheDocument();
  });

  it("shows error message when error is set", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      error: "Microphone access denied.",
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.getByText("Microphone access denied.")).toBeInTheDocument();
  });

  it("hides audio source selector during recording", () => {
    vi.mocked(useAudioCapture).mockReturnValue({
      ...mockAudioCaptureState,
      isRecording: true,
    });

    render(
      <RecordingPanel onAudioData={vi.fn()} onTranscriptUpdate={vi.fn()} />,
    );

    expect(screen.queryByText("Microphone only")).not.toBeInTheDocument();
  });
});

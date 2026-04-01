import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from "@testing-library/react";

// Mock next/navigation
const mockRouterPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock processRecordingAction
const mockProcessRecordingAction = vi.fn();
vi.mock("@/lib/actions/recording", () => ({
  processRecordingAction: (...args: unknown[]) =>
    mockProcessRecordingAction(...args),
}));

// Mock requestAnimationFrame
vi.stubGlobal(
  "requestAnimationFrame",
  (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number,
);
vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));

// Mock canvas
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

// Mock URL.createObjectURL and revokeObjectURL
vi.stubGlobal("URL", {
  createObjectURL: vi.fn().mockReturnValue("blob:mock-url"),
  revokeObjectURL: vi.fn(),
});

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

// Mock fetch for transcription token
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock @deepgram/sdk
const mockConnectionOn = vi.fn();
const mockConnectionSend = vi.fn();
const mockConnectionFinish = vi.fn();
const mockListenLive = vi.fn().mockReturnValue({
  on: mockConnectionOn,
  send: mockConnectionSend,
  finish: mockConnectionFinish,
});
const mockCreateClient = vi.fn().mockReturnValue({
  listen: { live: mockListenLive },
});

vi.mock("@deepgram/sdk", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
  LiveTranscriptionEvents: {
    Transcript: "Results",
    Open: "Open",
    Close: "Close",
    Error: "Error",
  },
}));

// Track onRecordingStart callback so we can trigger it manually
let capturedOnRecordingStart: (() => void) | undefined;
let capturedOnAudioData: ((chunks: Blob[]) => void) | undefined;

const mockStartCapture = vi.fn().mockResolvedValue(undefined);
const mockStopCapture = vi.fn();
const mockPauseCapture = vi.fn();
const mockResumeCapture = vi.fn();
const mockGetAudioChunks = vi
  .fn()
  .mockReturnValue([new Blob(["audio"], { type: "audio/webm" })]);

vi.mock("@/hooks/use-audio-capture", () => ({
  useAudioCapture: vi.fn(() => ({
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
  })),
}));

// Intercept RecordingPanel props to capture callbacks
vi.mock("../recording-panel", () => ({
  RecordingPanel: ({
    onAudioData,
    onRecordingStart,
  }: {
    onAudioData: (chunks: Blob[]) => void;
    onRecordingStart?: () => void;
    onChunk?: (chunk: Blob) => void;
    onTranscriptUpdate: (s: unknown[]) => void;
    className?: string;
  }) => {
    capturedOnRecordingStart = onRecordingStart;
    capturedOnAudioData = onAudioData;
    return (
      <div data-testid="recording-panel">
        <button onClick={onRecordingStart} aria-label="Start recording">
          Start Recording
        </button>
        <button
          onClick={() =>
            onAudioData([new Blob(["audio"], { type: "audio/webm" })])
          }
          aria-label="Stop recording"
        >
          Stop
        </button>
      </div>
    );
  },
}));

import { RecordingContainer } from "../recording-container";

describe("RecordingContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnRecordingStart = undefined;
    capturedOnAudioData = undefined;

    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ key: "test-deepgram-key", expiresAt: "2026-01-01" }),
    });

    mockProcessRecordingAction.mockResolvedValue({ meetingId: "meeting-123" });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders in setup phase with RecordingPanel", () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByTestId("recording-panel")).toBeInTheDocument();
    expect(screen.queryByText("Review Recording")).not.toBeInTheDocument();
  });

  it("transitions to recording phase when onRecordingStart fires", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    // After recording start, we should still see the recording panel
    // but now in recording phase (LiveTranscript appears)
    await waitFor(() => {
      expect(screen.getByTestId("recording-panel")).toBeInTheDocument();
    });
  });

  it("fetches Deepgram token on recording start", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/transcription/token", {
        method: "POST",
      });
    });
  });

  it("creates Deepgram client with fetched key", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    await waitFor(() => {
      expect(mockCreateClient).toHaveBeenCalledWith("test-deepgram-key");
    });
  });

  it("transitions to review phase when onAudioData fires", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    // Start recording
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    // Stop recording
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => {
      expect(screen.getByText("Review Recording")).toBeInTheDocument();
    });
  });

  it("shows Save & Process and Discard buttons in review phase", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => {
      expect(screen.getByText("Save & Process")).toBeInTheDocument();
      expect(screen.getByText("Discard")).toBeInTheDocument();
    });
  });

  it("Save & Process calls processRecordingAction and redirects on success", async () => {
    const onComplete = vi.fn();

    render(<RecordingContainer onComplete={onComplete} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => screen.getByText("Save & Process"));

    await act(async () => {
      fireEvent.click(screen.getByText("Save & Process"));
    });

    await waitFor(() => {
      expect(mockProcessRecordingAction).toHaveBeenCalledOnce();
    });
    const formData = mockProcessRecordingAction.mock.calls[0][0];
    expect(formData).toBeInstanceOf(FormData);
    expect(onComplete).toHaveBeenCalledOnce();
    expect(mockRouterPush).toHaveBeenCalledWith("/meetings");
  });

  it("Discard button shows confirmation dialog", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => screen.getByText("Discard"));

    await act(async () => {
      fireEvent.click(screen.getByText("Discard"));
    });

    expect(screen.getByText("Discard recording?")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure? This recording will be lost."),
    ).toBeInTheDocument();
  });

  it("confirming discard calls onDiscard", async () => {
    const onDiscard = vi.fn();

    render(<RecordingContainer onComplete={vi.fn()} onDiscard={onDiscard} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => screen.getByText("Discard"));

    await act(async () => {
      fireEvent.click(screen.getByText("Discard"));
    });

    await waitFor(() => screen.getByText("Discard recording?"));

    // Click the destructive Discard button in the dialog
    const discardButtons = screen.getAllByText("Discard");
    const dialogDiscard = discardButtons[discardButtons.length - 1];

    await act(async () => {
      fireEvent.click(dialogDiscard);
    });

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("cancelling discard dialog does not call onDiscard", async () => {
    const onDiscard = vi.fn();

    render(<RecordingContainer onComplete={vi.fn()} onDiscard={onDiscard} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => screen.getByText("Discard"));

    await act(async () => {
      fireEvent.click(screen.getByText("Discard"));
    });

    await waitFor(() => screen.getByText("Cancel"));

    await act(async () => {
      fireEvent.click(screen.getByText("Cancel"));
    });

    expect(onDiscard).not.toHaveBeenCalled();
  });

  it("shows processing spinner after Save & Process", async () => {
    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Stop recording"));
    });

    await waitFor(() => screen.getByText("Save & Process"));

    await act(async () => {
      fireEvent.click(screen.getByText("Save & Process"));
    });

    expect(screen.getByText("Processing recording...")).toBeInTheDocument();
  });

  it("continues without transcription when token fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });

    render(<RecordingContainer onComplete={vi.fn()} onDiscard={vi.fn()} />);

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Start recording"));
    });

    // Should still be in recording phase (not crashed)
    await waitFor(() => {
      expect(screen.getByTestId("recording-panel")).toBeInTheDocument();
    });
  });
});

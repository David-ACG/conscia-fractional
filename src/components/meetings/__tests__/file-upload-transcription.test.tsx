import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  waitFor,
} from "@testing-library/react";

// ── Supabase browser client mock ──────────────────────────────────────────────
const mockStorageUpload = vi.fn();
const mockStorageCreateSignedUrl = vi.fn();
const mockStorageRemove = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        createSignedUrl: mockStorageCreateSignedUrl,
        remove: mockStorageRemove,
      }),
    },
  })),
}));

// ── Fetch mock ────────────────────────────────────────────────────────────────
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// ── LiveTranscript mock ───────────────────────────────────────────────────────
vi.mock("../live-transcript", () => ({
  LiveTranscript: ({ segments }: { segments: unknown[] }) => (
    <div data-testid="live-transcript">
      <span>Segments: {segments.length}</span>
    </div>
  ),
}));

// ── UploadProgress mock ───────────────────────────────────────────────────────
vi.mock("../upload-progress", () => ({
  UploadProgress: ({
    stage,
    uploadProgress,
    onCancel,
    onRetry,
    errorMessage,
  }: {
    stage: string;
    uploadProgress: number;
    onCancel: () => void;
    onRetry: () => void;
    errorMessage?: string;
  }) => (
    <div data-testid="upload-progress" data-stage={stage}>
      <span data-testid="upload-pct">{uploadProgress}%</span>
      {errorMessage && <span data-testid="error-msg">{errorMessage}</span>}
      <button onClick={onCancel}>Cancel</button>
      <button onClick={onRetry}>Retry</button>
    </div>
  ),
}));

import { FileUploadTranscription } from "../file-upload-transcription";

const MOCK_SEGMENTS = [
  {
    text: "Hello",
    startMs: 0,
    endMs: 1000,
    speaker: "Speaker 1",
    confidence: 0.95,
  },
  {
    text: "World",
    startMs: 1000,
    endMs: 2000,
    speaker: "Speaker 2",
    confidence: 0.9,
  },
];

function makeFile(
  name = "recording.mp3",
  size = 1024 * 1024,
  type = "audio/mpeg",
): File {
  // Create a minimal 1-byte File and override `size` to avoid OOM in tests
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size, configurable: true });
  return file;
}

afterEach(() => cleanup());

describe("FileUploadTranscription", () => {
  const onComplete = vi.fn();
  const onDiscard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed/recording.mp3" },
      error: null,
    });
    mockStorageRemove.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ segments: MOCK_SEGMENTS }),
    });
  });

  it("renders drop zone in idle state", () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    expect(
      screen.getByText("Drop audio or video file here"),
    ).toBeInTheDocument();
    expect(screen.getByText(/MP3, WAV, MP4/)).toBeInTheDocument();
  });

  it("shows file info after selecting a valid file via input", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");
    const file = makeFile("test.mp3", 2 * 1024 * 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText("test.mp3")).toBeInTheDocument();
    expect(screen.getByText("Transcribe")).toBeInTheDocument();
  });

  it("shows error for files over 500MB", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");
    const bigFile = makeFile("huge.mp4", 501 * 1024 * 1024, "video/mp4");

    await act(async () => {
      fireEvent.change(input, { target: { files: [bigFile] } });
    });

    expect(screen.getByText("File exceeds 500MB limit")).toBeInTheDocument();
    expect(screen.queryByText("Transcribe")).not.toBeInTheDocument();
  });

  it("accepts exactly 500MB without error", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");
    const file = makeFile("exact.mp3", 500 * 1024 * 1024);

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(
      screen.queryByText("File exceeds 500MB limit"),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Transcribe")).toBeInTheDocument();
  });

  it("accepts file via drag and drop", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const dropZone = screen.getByRole("button", {
      name: "Drop audio or video file here",
    });
    const file = makeFile("dropped.wav");

    await act(async () => {
      fireEvent.dragOver(dropZone);
      fireEvent.drop(dropZone, { dataTransfer: { files: [file] } });
    });

    expect(screen.getByText("dropped.wav")).toBeInTheDocument();
  });

  it("removes selected file when X button clicked", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");
    const file = makeFile("test.mp3");

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });

    expect(screen.getByText("test.mp3")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Remove file"));
    });

    expect(screen.queryByText("test.mp3")).not.toBeInTheDocument();
    expect(screen.queryByText("Transcribe")).not.toBeInTheDocument();
  });

  it("transitions to upload progress on Transcribe click", async () => {
    // Delay upload so the uploading stage is visible before resolution
    let resolveUpload!: (v: { error: null }) => void;
    mockStorageUpload.mockImplementationOnce(
      () =>
        new Promise<{ error: null }>((res) => {
          resolveUpload = res;
        }),
    );

    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });

    // Start transcription (don't await so component stays in uploading)
    act(() => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    // UploadProgress should be visible while upload is in progress
    await waitFor(() => {
      expect(screen.getByTestId("upload-progress")).toBeInTheDocument();
    });

    // Resolve to avoid memory leaks
    await act(async () => {
      resolveUpload({ error: null });
    });
  });

  it("calls Supabase upload and transcription API on Transcribe", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile("audio.mp3")] } });
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => {
      expect(mockStorageUpload).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/transcription/batch",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows review phase with LiveTranscript after successful transcription", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("live-transcript")).toBeInTheDocument();
    });
    expect(screen.getByText("Segments: 2")).toBeInTheDocument();
    expect(screen.getByText("Process & Save")).toBeInTheDocument();
    expect(screen.getByText("Discard")).toBeInTheDocument();
  });

  it("Process & Save calls onComplete with correct data", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile("meeting.mp3")] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => screen.getByText("Process & Save"));

    await act(async () => {
      fireEvent.click(screen.getByText("Process & Save"));
    });

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        segments: MOCK_SEGMENTS,
        audioUrl: "https://storage.example.com/signed/recording.mp3",
        fileName: "meeting.mp3",
      }),
    );
  });

  it("Discard button shows confirmation dialog", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => screen.getByText("Discard"));

    await act(async () => {
      fireEvent.click(screen.getByText("Discard"));
    });

    expect(screen.getByText("Discard recording?")).toBeInTheDocument();
  });

  it("confirming discard removes file from storage and calls onDiscard", async () => {
    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => screen.getByText("Discard"));

    await act(async () => {
      fireEvent.click(screen.getByText("Discard"));
    });

    await waitFor(() => screen.getByText("Discard recording?"));

    // Click the destructive Discard in the dialog
    const discardButtons = screen.getAllByText("Discard");
    const dialogButton = discardButtons[discardButtons.length - 1]!;

    await act(async () => {
      fireEvent.click(dialogButton);
    });

    expect(mockStorageRemove).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("shows error stage when upload fails", async () => {
    mockStorageUpload.mockResolvedValueOnce({
      error: { message: "Storage quota exceeded" },
    });

    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("upload-progress")).toHaveAttribute(
        "data-stage",
        "error",
      );
    });
    expect(screen.getByTestId("error-msg")).toHaveTextContent(
      "Storage quota exceeded",
    );
  });

  it("shows error stage when transcription API fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({ error: "Transcription service unavailable" }),
    });

    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("upload-progress")).toHaveAttribute(
        "data-stage",
        "error",
      );
    });
    expect(screen.getByTestId("error-msg")).toHaveTextContent(
      "Transcription service unavailable",
    );
  });

  it("Retry resets to idle state", async () => {
    mockStorageUpload.mockResolvedValueOnce({
      error: { message: "Upload failed" },
    });

    render(
      <FileUploadTranscription onComplete={onComplete} onDiscard={onDiscard} />,
    );
    const input = screen.getByLabelText("Select audio or video file");

    await act(async () => {
      fireEvent.change(input, { target: { files: [makeFile()] } });
    });
    await act(async () => {
      fireEvent.click(screen.getByText("Transcribe"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("upload-progress")).toHaveAttribute(
        "data-stage",
        "error",
      );
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Retry"));
    });

    // Back to idle — drop zone visible
    expect(
      screen.getByText("Drop audio or video file here"),
    ).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAudioCapture } from "../use-audio-capture";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createFakeTrack(kind = "audio"): MediaStreamTrack {
  return {
    kind,
    stop: vi.fn(),
    enabled: true,
    id: Math.random().toString(36).slice(2),
  } as unknown as MediaStreamTrack;
}

function createFakeStream(tracks: MediaStreamTrack[] = []): MediaStream {
  const audioTracks = tracks.filter((t) => t.kind === "audio");
  const videoTracks = tracks.filter((t) => t.kind === "video");
  return {
    getTracks: vi.fn(() => tracks),
    getAudioTracks: vi.fn(() => audioTracks),
    getVideoTracks: vi.fn(() => videoTracks),
  } as unknown as MediaStream;
}

// ---------------------------------------------------------------------------
// MediaRecorder mock
// ---------------------------------------------------------------------------

let latestRecorder: MockMediaRecorder | null = null;

class MockMediaRecorder {
  state: "inactive" | "recording" | "paused" = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  mimeType: string;

  start = vi.fn((_timeslice?: number) => {
    this.state = "recording";
  });

  stop = vi.fn(() => {
    this.state = "inactive";
    this.onstop?.();
  });

  pause = vi.fn(() => {
    this.state = "paused";
  });

  resume = vi.fn(() => {
    this.state = "recording";
  });

  static isTypeSupported = vi.fn(
    (type: string) => type === "audio/webm;codecs=opus",
  );

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "audio/webm";
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    latestRecorder = this;
  }
}

// ---------------------------------------------------------------------------
// AudioContext mock
// ---------------------------------------------------------------------------

function createMockAudioContext() {
  const mockSource = { connect: vi.fn() };
  const mockDestination = { stream: createFakeStream() };
  return {
    createMediaStreamSource: vi.fn(() => mockSource),
    createMediaStreamDestination: vi.fn(() => mockDestination),
    createAnalyser: vi.fn(() => ({
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
      connect: vi.fn(),
    })),
    close: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// AudioLevelMonitor mock
// ---------------------------------------------------------------------------

// Use a proper class so `new AudioLevelMonitor(...)` works in vitest 4
// (vi.fn().mockImplementation(arrowFn) fails as a constructor in vitest 4)
vi.mock("@/lib/audio-level", () => ({
  AudioLevelMonitor: class {
    start = vi.fn();
    stop = vi.fn();
    getLevel = vi.fn(() => 0);
  },
}));

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

let mockGetUserMedia: ReturnType<typeof vi.fn>;
let mockGetDisplayMedia: ReturnType<typeof vi.fn>;
let mockAudioContext: ReturnType<typeof createMockAudioContext>;

beforeEach(() => {
  latestRecorder = null;
  mockGetUserMedia = vi.fn();
  mockGetDisplayMedia = vi.fn();
  mockAudioContext = createMockAudioContext();

  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: mockGetUserMedia,
      getDisplayMedia: mockGetDisplayMedia,
    },
    writable: true,
    configurable: true,
  });

  vi.stubGlobal("MediaRecorder", MockMediaRecorder);
  // Use a proper class so `new AudioContext()` correctly creates an instance
  // with all mock methods bound to the current test's mockAudioContext
  const ctx = mockAudioContext;
  vi.stubGlobal(
    "AudioContext",
    class MockAudioContext {
      createMediaStreamSource = ctx.createMediaStreamSource;
      createMediaStreamDestination = ctx.createMediaStreamDestination;
      createAnalyser = ctx.createAnalyser;
      close = ctx.close;
    },
  );
  vi.stubGlobal("requestAnimationFrame", vi.fn());
  vi.stubGlobal("cancelAnimationFrame", vi.fn());

  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useAudioCapture", () => {
  it("returns initial state", () => {
    const { result } = renderHook(() => useAudioCapture());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.duration).toBe(0);
    expect(result.current.audioLevel).toBe(0);
    expect(result.current.error).toBeNull();
    expect(result.current.mediaRecorder).toBeNull();
  });

  describe("startCapture — microphone only", () => {
    it("calls getUserMedia and starts MediaRecorder", async () => {
      const micTrack = createFakeTrack("audio");
      const micStream = createFakeStream([micTrack]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockGetDisplayMedia).not.toHaveBeenCalled();
      expect(result.current.isRecording).toBe(true);
      expect(result.current.isPaused).toBe(false);
      expect(result.current.error).toBeNull();
      expect(latestRecorder?.start).toHaveBeenCalledWith(250);
    });

    it("exposes the MediaRecorder instance in state", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      expect(result.current.mediaRecorder).not.toBeNull();
    });
  });

  describe("startCapture — tab audio + microphone (mixing)", () => {
    it("calls both getUserMedia and getDisplayMedia, creates AudioContext", async () => {
      const micTrack = createFakeTrack("audio");
      const micStream = createFakeStream([micTrack]);
      const videoTrack = createFakeTrack("video");
      const displayStream = createFakeStream([videoTrack]);
      displayStream.getVideoTracks = vi.fn(() => [videoTrack]);

      mockGetUserMedia.mockResolvedValue(micStream);
      mockGetDisplayMedia.mockResolvedValue(displayStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: true,
          systemAudio: false,
        });
      });

      expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(mockGetDisplayMedia).toHaveBeenCalledWith({
        audio: true,
        video: true,
      });
      expect(videoTrack.stop).toHaveBeenCalled();
      expect(mockAudioContext.createMediaStreamDestination).toHaveBeenCalled();
      expect(result.current.isRecording).toBe(true);
    });

    it("continues with mic only when tab audio is cancelled", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);
      mockGetDisplayMedia.mockRejectedValue(
        new DOMException("Cancelled", "AbortError"),
      );

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: true,
          systemAudio: false,
        });
      });

      expect(result.current.isRecording).toBe(true);
      expect(result.current.error).toBe(
        "Tab audio sharing was cancelled. Recording with microphone only.",
      );
    });

    it("stops entirely when tab audio is cancelled and no mic", async () => {
      mockGetDisplayMedia.mockRejectedValue(
        new DOMException("Cancelled", "AbortError"),
      );

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: false,
          tabAudio: true,
          systemAudio: false,
        });
      });

      expect(result.current.isRecording).toBe(false);
      expect(result.current.error).toBe(
        "Tab audio sharing was cancelled. Recording with microphone only.",
      );
    });
  });

  describe("stopCapture", () => {
    it("returns a Blob and resets state", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      let blob: Blob | null = null;
      act(() => {
        blob = result.current.stopCapture();
      });

      expect(blob).toBeInstanceOf(Blob);
      expect((blob as unknown as Blob).type).toBe("audio/webm");
      expect(result.current.isRecording).toBe(false);
      expect(result.current.mediaRecorder).toBeNull();
    });

    it("calls stop() on the MediaRecorder", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        result.current.stopCapture();
      });

      expect(latestRecorder?.stop).toHaveBeenCalled();
    });

    it("stops all media tracks", async () => {
      const track = createFakeTrack();
      const micStream = createFakeStream([track]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        result.current.stopCapture();
      });

      expect(track.stop).toHaveBeenCalled();
    });

    it("returns null when not recording", () => {
      const { result } = renderHook(() => useAudioCapture());

      let blob: Blob | null;
      act(() => {
        blob = result.current.stopCapture();
      });

      expect(blob!).toBeNull();
    });

    it("includes collected chunks in the returned blob", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      // Simulate chunks arriving via ondataavailable
      act(() => {
        latestRecorder?.ondataavailable?.({
          data: new Blob(["chunk1"], { type: "audio/webm" }),
        } as BlobEvent);
        latestRecorder?.ondataavailable?.({
          data: new Blob(["chunk2"], { type: "audio/webm" }),
        } as BlobEvent);
      });

      let blob: Blob | null = null;
      act(() => {
        blob = result.current.stopCapture();
      });

      expect((blob as unknown as Blob).size).toBeGreaterThan(0);
    });
  });

  describe("pauseCapture / resumeCapture", () => {
    it("pauses and resumes the MediaRecorder and toggles isPaused", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        result.current.pauseCapture();
      });

      expect(latestRecorder?.pause).toHaveBeenCalled();
      expect(result.current.isPaused).toBe(true);

      act(() => {
        result.current.resumeCapture();
      });

      expect(latestRecorder?.resume).toHaveBeenCalled();
      expect(result.current.isPaused).toBe(false);
    });

    it("does not call pause when already paused", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        result.current.pauseCapture();
      });

      // Second pause attempt — recorder state is 'paused', not 'recording'
      act(() => {
        result.current.pauseCapture();
      });

      expect(latestRecorder?.pause).toHaveBeenCalledTimes(1);
    });
  });

  describe("duration counter", () => {
    it("increments every second while recording", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.duration).toBe(3);
    });

    it("stops incrementing when paused", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      act(() => {
        result.current.pauseCapture();
      });

      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should still be at 2 (paused for 2s)
      expect(result.current.duration).toBe(2);

      act(() => {
        result.current.resumeCapture();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.duration).toBe(3);
    });
  });

  describe("error handling", () => {
    it("sets NotAllowedError message when mic permission denied", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Permission denied", "NotAllowedError"),
      );

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      expect(result.current.error).toBe(
        "Microphone access denied. Please allow microphone access in your browser settings.",
      );
      expect(result.current.isRecording).toBe(false);
    });

    it("sets NotFoundError message when no mic device found", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Requested device not found", "NotFoundError"),
      );

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      expect(result.current.error).toBe(
        "No microphone found. Please connect a microphone.",
      );
    });

    it("sets generic error message for unknown errors", async () => {
      mockGetUserMedia.mockRejectedValue(
        new DOMException("Something went wrong", "UnknownError"),
      );

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      expect(result.current.error).toBe(
        "Recording failed: Something went wrong",
      );
    });
  });

  describe("getAudioChunks", () => {
    it("returns copy of collected chunks", async () => {
      const micStream = createFakeStream([createFakeTrack()]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      const chunk = new Blob(["data"], { type: "audio/webm" });
      act(() => {
        latestRecorder?.ondataavailable?.({ data: chunk } as BlobEvent);
      });

      const chunks = result.current.getAudioChunks();
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(chunk);
    });

    it("returns empty array when not recording", () => {
      const { result } = renderHook(() => useAudioCapture());
      expect(result.current.getAudioChunks()).toEqual([]);
    });
  });

  describe("cleanup on unmount", () => {
    it("stops tracks and closes AudioContext on unmount", async () => {
      const track = createFakeTrack();
      const micStream = createFakeStream([track]);
      mockGetUserMedia.mockResolvedValue(micStream);

      const { result, unmount } = renderHook(() => useAudioCapture());

      await act(async () => {
        await result.current.startCapture({
          microphone: true,
          tabAudio: false,
          systemAudio: false,
        });
      });

      unmount();

      expect(track.stop).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });
});

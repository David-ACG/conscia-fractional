import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AudioLevelMonitor } from "../audio-level";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockGetByteFrequencyData: ReturnType<typeof vi.fn>;
let mockConnect: ReturnType<typeof vi.fn>;
let mockAnalyser: AnalyserNode;
let mockSource: MediaStreamAudioSourceNode;
let mockAudioContext: AudioContext;
let rafCallback: ((time: number) => void) | null = null;

function setupMocks(frequencyData: number[] = []) {
  mockGetByteFrequencyData = vi.fn((array: Uint8Array) => {
    for (let i = 0; i < Math.min(array.length, frequencyData.length); i++) {
      array[i] = frequencyData[i] ?? 0;
    }
  });

  mockConnect = vi.fn();

  mockAnalyser = {
    fftSize: 256,
    frequencyBinCount: frequencyData.length || 4,
    getByteFrequencyData: mockGetByteFrequencyData,
    connect: mockConnect,
  } as unknown as AnalyserNode;

  mockSource = {
    connect: vi.fn(),
  } as unknown as MediaStreamAudioSourceNode;

  mockAudioContext = {
    createAnalyser: vi.fn(() => mockAnalyser),
  } as unknown as AudioContext;

  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn((cb: (time: number) => void) => {
      rafCallback = cb;
      return 42;
    }),
  );

  vi.stubGlobal("cancelAnimationFrame", vi.fn());
}

beforeEach(() => {
  rafCallback = null;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AudioLevelMonitor", () => {
  describe("constructor", () => {
    it("creates an analyser with fftSize 256 and connects source", () => {
      setupMocks([0, 0, 0, 0]);
      const onLevel = vi.fn();
      new AudioLevelMonitor(mockAudioContext, mockSource, onLevel);

      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
      expect(mockAnalyser.fftSize).toBe(256);
      expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser);
    });
  });

  describe("start", () => {
    it("calls requestAnimationFrame to begin the loop", () => {
      setupMocks([0, 0, 0, 0]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();

      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it("reads frequency data on each frame", () => {
      setupMocks([128, 128, 128, 128]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      // Trigger one animation frame
      rafCallback?.(0);

      expect(mockGetByteFrequencyData).toHaveBeenCalled();
    });

    it("calls onLevel callback with a value between 0 and 1", () => {
      // 128/255 ≈ 0.502 per sample → RMS ≈ 0.502
      setupMocks([128, 128, 128, 128]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      rafCallback?.(0);

      expect(onLevel).toHaveBeenCalledTimes(1);
      const level = onLevel.mock.calls[0]?.[0] as number;
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
    });

    it("returns level ~0 for silence (all zeroes)", () => {
      setupMocks([0, 0, 0, 0]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      rafCallback?.(0);

      const level = onLevel.mock.calls[0]?.[0] as number;
      expect(level).toBe(0);
    });

    it("returns level ~1 for full-scale signal (all 255)", () => {
      setupMocks([255, 255, 255, 255]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      rafCallback?.(0);

      const level = onLevel.mock.calls[0]?.[0] as number;
      expect(level).toBeCloseTo(1, 5);
    });

    it("schedules the next frame after each callback", () => {
      setupMocks([64, 64, 64, 64]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );
      let rafCallCount = 0;
      vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((cb: (time: number) => void) => {
          rafCallCount++;
          rafCallback = cb;
          return rafCallCount;
        }),
      );

      monitor.start(); // first rAF call
      expect(rafCallCount).toBe(1);

      rafCallback?.(0); // triggers loop body → second rAF call
      expect(rafCallCount).toBe(2);
    });
  });

  describe("stop", () => {
    it("cancels the animation frame", () => {
      setupMocks([0, 0, 0, 0]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      monitor.stop();

      expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    });

    it("does not throw when stop is called before start", () => {
      setupMocks([0, 0, 0, 0]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      expect(() => monitor.stop()).not.toThrow();
    });

    it("cancels the pending animation frame so onLevel is never called", () => {
      setupMocks([128, 128, 128, 128]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      // stop() before the rAF callback fires — the frame id (42) is cancelled
      monitor.start();
      monitor.stop();

      expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
      // The frame was cancelled before it could fire, so onLevel was never called
      expect(onLevel).not.toHaveBeenCalled();
    });
  });

  describe("getLevel", () => {
    it("returns 0 before start", () => {
      setupMocks([255, 255, 255, 255]);
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        vi.fn(),
      );

      expect(monitor.getLevel()).toBe(0);
    });

    it("returns the last computed level after a frame", () => {
      setupMocks([255, 255, 255, 255]);
      const onLevel = vi.fn();
      const monitor = new AudioLevelMonitor(
        mockAudioContext,
        mockSource,
        onLevel,
      );

      monitor.start();
      rafCallback?.(0);

      expect(monitor.getLevel()).toBeCloseTo(1, 5);
    });
  });
});

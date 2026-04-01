import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkAudioSupport } from "../browser-compat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubMediaDevices(
  getUserMedia: boolean,
  getDisplayMedia: boolean,
): void {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      ...(getUserMedia && { getUserMedia: vi.fn() }),
      ...(getDisplayMedia && { getDisplayMedia: vi.fn() }),
    },
    writable: true,
    configurable: true,
  });
}

function stubChromium(isChromium: boolean): void {
  if (isChromium) {
    // Simplest Chromium signal: window.chrome exists
    vi.stubGlobal("chrome", {});
  }
  // If not Chromium, window.chrome stays undefined and jsdom UA has no Chrome token
}

beforeEach(() => {
  // Reset navigator.mediaDevices to empty by default
  Object.defineProperty(navigator, "mediaDevices", {
    value: {},
    writable: true,
    configurable: true,
  });
  // Ensure window.chrome is not present
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkAudioSupport", () => {
  describe("with all APIs available on Chromium", () => {
    beforeEach(() => {
      stubMediaDevices(true, true);
      stubChromium(true);
      vi.stubGlobal("MediaRecorder", class {});
      vi.stubGlobal("AudioContext", class {});
    });

    it("reports microphone as available", () => {
      expect(checkAudioSupport().microphone).toBe(true);
    });

    it("reports tabAudio as available", () => {
      expect(checkAudioSupport().tabAudio).toBe(true);
    });

    it("reports systemAudio as available", () => {
      expect(checkAudioSupport().systemAudio).toBe(true);
    });

    it("reports mediaRecorder as available", () => {
      expect(checkAudioSupport().mediaRecorder).toBe(true);
    });

    it("reports audioContext as available", () => {
      expect(checkAudioSupport().audioContext).toBe(true);
    });

    it("has no warnings about tab/system audio", () => {
      const { warnings } = checkAudioSupport();
      const tabWarning = warnings.find((w) => w.includes("Tab/system audio"));
      expect(tabWarning).toBeUndefined();
    });
  });

  describe("on non-Chromium browser (Firefox/Safari) with getUserMedia only", () => {
    beforeEach(() => {
      stubMediaDevices(true, true); // getDisplayMedia exists but not Chromium
      // Don't stub window.chrome → not detected as Chromium
      vi.stubGlobal("MediaRecorder", class {});
      vi.stubGlobal("AudioContext", class {});
    });

    it("reports microphone as available", () => {
      expect(checkAudioSupport().microphone).toBe(true);
    });

    it("reports tabAudio as false", () => {
      expect(checkAudioSupport().tabAudio).toBe(false);
    });

    it("reports systemAudio as false", () => {
      expect(checkAudioSupport().systemAudio).toBe(false);
    });

    it("includes Chromium warning", () => {
      const { warnings } = checkAudioSupport();
      expect(warnings.some((w) => w.includes("Chromium-based browser"))).toBe(
        true,
      );
    });
  });

  describe("with no browser APIs available", () => {
    beforeEach(() => {
      // Empty mediaDevices (no getUserMedia, no getDisplayMedia)
      Object.defineProperty(navigator, "mediaDevices", {
        value: {},
        writable: true,
        configurable: true,
      });
      // No MediaRecorder, no AudioContext, no chrome
    });

    it("reports all capabilities as false", () => {
      const caps = checkAudioSupport();
      expect(caps.microphone).toBe(false);
      expect(caps.tabAudio).toBe(false);
      expect(caps.systemAudio).toBe(false);
      expect(caps.mediaRecorder).toBe(false);
      expect(caps.audioContext).toBe(false);
    });

    it("includes appropriate warnings", () => {
      const { warnings } = checkAudioSupport();
      expect(warnings.length).toBeGreaterThan(0);
    });
  });

  describe("Chromium detection", () => {
    beforeEach(() => {
      stubMediaDevices(true, true);
      vi.stubGlobal("MediaRecorder", class {});
      vi.stubGlobal("AudioContext", class {});
    });

    it("detects Chromium via window.chrome", () => {
      vi.stubGlobal("chrome", {});
      const caps = checkAudioSupport();
      expect(caps.tabAudio).toBe(true);
      expect(caps.systemAudio).toBe(true);
    });

    it("does not detect Chromium without window.chrome in jsdom", () => {
      // jsdom UA doesn't contain Chrome/Edg/OPR/Brave and no window.chrome
      const caps = checkAudioSupport();
      expect(caps.tabAudio).toBe(false);
      expect(caps.systemAudio).toBe(false);
    });
  });

  describe("webkitAudioContext fallback", () => {
    it("reports audioContext true when only webkitAudioContext is available", () => {
      stubMediaDevices(false, false);
      // Stub webkitAudioContext on window
      vi.stubGlobal("webkitAudioContext", class {});
      // Ensure standard AudioContext is absent
      expect(typeof window.AudioContext).toBe("undefined");

      const caps = checkAudioSupport();
      expect(caps.audioContext).toBe(true);
    });
  });

  describe("warnings content", () => {
    it("warns about MediaRecorder when unavailable", () => {
      stubMediaDevices(true, true);
      stubChromium(true);
      vi.stubGlobal("AudioContext", class {});
      // No MediaRecorder stub → window.MediaRecorder is undefined

      const { warnings } = checkAudioSupport();
      expect(warnings.some((w) => w.includes("MediaRecorder"))).toBe(true);
    });

    it("warns about Web Audio when unavailable", () => {
      stubMediaDevices(true, true);
      stubChromium(true);
      vi.stubGlobal("MediaRecorder", class {});
      // No AudioContext stub

      const { warnings } = checkAudioSupport();
      expect(warnings.some((w) => w.includes("Web Audio"))).toBe(true);
    });

    it("warns about microphone when getUserMedia unavailable", () => {
      stubMediaDevices(false, false);
      vi.stubGlobal("MediaRecorder", class {});
      vi.stubGlobal("AudioContext", class {});

      const { warnings } = checkAudioSupport();
      expect(warnings.some((w) => w.includes("Microphone"))).toBe(true);
    });
  });
});

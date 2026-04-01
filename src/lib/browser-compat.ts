export interface AudioCapabilities {
  microphone: boolean;
  tabAudio: boolean;
  systemAudio: boolean;
  mediaRecorder: boolean;
  audioContext: boolean;
  warnings: string[];
}

function isChromium(): boolean {
  if (typeof window === "undefined") return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).chrome) return true;
  const ua = navigator.userAgent;
  return /Chrome|Chromium|Edg|Brave|OPR|Opera/i.test(ua);
}

export function checkAudioSupport(): AudioCapabilities {
  const warnings: string[] = [];

  const microphone =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  const hasDisplayMedia =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getDisplayMedia;

  const chromium = isChromium();

  const tabAudio = hasDisplayMedia && chromium;
  const systemAudio = hasDisplayMedia && chromium;

  if (!chromium && hasDisplayMedia) {
    warnings.push(
      "Tab/system audio capture requires Chrome, Edge, or another Chromium-based browser",
    );
  }

  if (!hasDisplayMedia && !chromium) {
    warnings.push(
      "Tab/system audio capture requires Chrome, Edge, or another Chromium-based browser",
    );
  }

  const mediaRecorder = typeof window !== "undefined" && !!window.MediaRecorder;

  const audioContext =
    typeof window !== "undefined" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    !!(window.AudioContext || (window as any).webkitAudioContext);

  if (!microphone)
    warnings.push("Microphone access is not available in this browser");
  if (!mediaRecorder)
    warnings.push("MediaRecorder API is not available in this browser");
  if (!audioContext)
    warnings.push("Web Audio API is not available in this browser");

  return {
    microphone,
    tabAudio,
    systemAudio,
    mediaRecorder,
    audioContext,
    warnings,
  };
}

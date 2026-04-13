/**
 * Client-side audio compression for meeting recordings.
 *
 * Converts any audio/video file to a low-bitrate mono MP3 at 16 kHz —
 * optimised for speech transcription and small enough to stay under
 * Supabase free-tier's 50 MB upload limit.
 */

import { Mp3Encoder } from "@breezystack/lamejs";

const TARGET_SAMPLE_RATE = 16_000; // 16 kHz — standard for speech
const TARGET_BITRATE = 32; // kbps — sufficient for speech, ~14 MB/hour
const CHUNK_SIZE = 1152; // MP3 frame size for MPEG1

export interface CompressProgress {
  /** 0–100 */
  percent: number;
  stage: "decoding" | "resampling" | "encoding";
}

/**
 * Compress an audio file to a small MP3 suitable for upload & transcription.
 *
 * @returns A Blob of type audio/mpeg, typically 14-20 MB per hour of audio.
 */
export async function compressAudio(
  file: File,
  onProgress?: (p: CompressProgress) => void,
): Promise<Blob> {
  // 1. Decode to raw PCM via Web Audio API
  onProgress?.({ percent: 0, stage: "decoding" });
  const arrayBuffer = await file.arrayBuffer();

  // Use default AudioContext (browser picks native sample rate)
  const audioCtx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    await audioCtx.close();
  }

  console.log(
    `[compress] Decoded: ${decoded.duration.toFixed(1)}s, ${decoded.sampleRate}Hz, ${decoded.numberOfChannels}ch`,
  );
  onProgress?.({ percent: 10, stage: "resampling" });

  // 2. Resample to 16 kHz mono via OfflineAudioContext
  const targetLength = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, targetLength, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start(0);
  const rendered = await offline.startRendering();

  console.log(
    `[compress] Resampled: ${rendered.length} samples at ${rendered.sampleRate}Hz (${(rendered.length / rendered.sampleRate).toFixed(1)}s)`,
  );
  onProgress?.({ percent: 20, stage: "encoding" });

  // 3. Convert Float32 to Int16
  const samples = rendered.getChannelData(0);
  const totalSamples = samples.length;
  const int16 = new Int16Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  // 4. Encode to MP3 via lamejs
  const mp3Encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, TARGET_BITRATE);
  const mp3Chunks: Uint8Array[] = [];

  let offset = 0;
  while (offset < totalSamples) {
    const end = Math.min(offset + CHUNK_SIZE, totalSamples);
    const chunk = int16.subarray(offset, end);
    const mp3buf: Uint8Array = mp3Encoder.encodeBuffer(chunk);
    if (mp3buf.length > 0) {
      mp3Chunks.push(new Uint8Array(mp3buf));
    }
    offset = end;

    // Report progress periodically
    if (offset % (TARGET_SAMPLE_RATE * 10) < CHUNK_SIZE) {
      const pct = 20 + Math.round((offset / totalSamples) * 80);
      onProgress?.({ percent: Math.min(pct, 99), stage: "encoding" });
      // Yield to UI thread
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Flush remaining
  const tail: Uint8Array = mp3Encoder.flush();
  if (tail.length > 0) {
    mp3Chunks.push(new Uint8Array(tail));
  }

  onProgress?.({ percent: 100, stage: "encoding" });

  const blob = new Blob(mp3Chunks as BlobPart[], { type: "audio/mpeg" });
  console.log(
    `[compress] Encoded: ${(blob.size / 1024 / 1024).toFixed(1)} MB (target bitrate: ${TARGET_BITRATE}kbps)`,
  );

  return blob;
}

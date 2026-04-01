"use client";

import * as React from "react";
import { Mic, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  useAudioCapture,
  type AudioCaptureOptions,
} from "@/hooks/use-audio-capture";
import { checkAudioSupport } from "@/lib/browser-compat";
import type { TranscriptSegment } from "@/lib/types/transcription";
import { cn } from "@/lib/utils";

interface RecordingPanelProps {
  onAudioData: (chunks: Blob[]) => void;
  onTranscriptUpdate: (segments: TranscriptSegment[]) => void;
  onRecordingStart?: () => void;
  onChunk?: (chunk: Blob) => void;
  className?: string;
}

type AudioSource = "microphone" | "tab" | "system";

function formatDuration(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

const WAVEFORM_SAMPLES = 60;

export function RecordingPanel({
  onAudioData,
  onTranscriptUpdate: _onTranscriptUpdate,
  onRecordingStart,
  onChunk,
  className,
}: RecordingPanelProps) {
  const {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    mediaRecorder,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    getAudioChunks,
  } = useAudioCapture();

  const capabilities = React.useMemo(() => checkAudioSupport(), []);
  const [audioSource, setAudioSource] =
    React.useState<AudioSource>("microphone");

  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const samplesRef = React.useRef<number[]>(
    new Array(WAVEFORM_SAMPLES).fill(0),
  );
  const rafRef = React.useRef<number | null>(null);
  const wasRecordingRef = React.useRef(false);

  // Push new audio level into rolling window
  React.useEffect(() => {
    samplesRef.current = [...samplesRef.current.slice(1), audioLevel];
  }, [audioLevel]);

  // Notify parent when recording starts (once per recording session)
  React.useEffect(() => {
    if (isRecording && !wasRecordingRef.current) {
      onRecordingStart?.();
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording, onRecordingStart]);

  // Wire up per-chunk streaming callback
  React.useEffect(() => {
    if (!mediaRecorder || !onChunk) return;
    const handler = (e: BlobEvent) => {
      if (e.data.size > 0) onChunk(e.data);
    };
    mediaRecorder.addEventListener("dataavailable", handler);
    return () => mediaRecorder.removeEventListener("dataavailable", handler);
  }, [mediaRecorder, onChunk]);

  // Waveform canvas animation
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function draw() {
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const samples = samplesRef.current;
      const barWidth = width / samples.length;
      ctx.fillStyle =
        isRecording && !isPaused
          ? "hsl(var(--primary))"
          : "hsl(var(--muted-foreground))";

      for (let i = 0; i < samples.length; i++) {
        const barHeight = Math.max(2, samples[i] * height);
        const x = i * barWidth;
        const y = (height - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [isRecording, isPaused]);

  async function handleStart() {
    const options: AudioCaptureOptions = {
      microphone: true,
      tabAudio: audioSource === "tab",
      systemAudio: audioSource === "system",
    };
    await startCapture(options);
  }

  function handleStop() {
    const chunks = getAudioChunks();
    stopCapture();
    onAudioData(chunks);
  }

  const statusBadge =
    isRecording && !isPaused ? (
      <Badge className="bg-red-500 text-white gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse inline-block" />
        Recording
      </Badge>
    ) : isPaused ? (
      <Badge className="bg-yellow-500 text-white gap-1.5">
        <span className="h-2 w-2 rounded-full bg-white inline-block" />
        Paused
      </Badge>
    ) : (
      <Badge variant="secondary" className="gap-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground inline-block" />
        Ready
      </Badge>
    );

  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Recording</CardTitle>
        {statusBadge}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Audio source selector — only shown when not recording */}
        {!isRecording && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Audio source</p>
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="audio-source"
                  value="microphone"
                  checked={audioSource === "microphone"}
                  onChange={() => setAudioSource("microphone")}
                />
                Microphone only
              </label>
              {capabilities.tabAudio && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="audio-source"
                    value="tab"
                    checked={audioSource === "tab"}
                    onChange={() => setAudioSource("tab")}
                  />
                  Tab audio + Microphone
                </label>
              )}
              {capabilities.systemAudio && (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="audio-source"
                    value="system"
                    checked={audioSource === "system"}
                    onChange={() => setAudioSource("system")}
                  />
                  System audio + Microphone
                </label>
              )}
            </div>
            {capabilities.warnings.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {capabilities.warnings[0]}
              </p>
            )}
          </div>
        )}

        {/* Duration counter */}
        <div
          className="text-2xl font-mono tabular-nums text-center"
          aria-label="Recording duration"
        >
          {formatDuration(duration)}
        </div>

        {/* Waveform visualiser */}
        <canvas
          ref={canvasRef}
          width={400}
          height={48}
          className="w-full h-12 rounded"
          aria-hidden="true"
        />

        {/* Controls */}
        <div className="flex items-center justify-center gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStart}
              className="bg-red-600 hover:bg-red-700 text-white"
              size="lg"
              aria-label="Start recording"
            >
              <Mic className="mr-2 h-5 w-5" />
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={isPaused ? resumeCapture : pauseCapture}
                aria-label={isPaused ? "Resume recording" : "Pause recording"}
              >
                {isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="destructive"
                size="default"
                onClick={handleStop}
                aria-label="Stop recording"
              >
                <Square className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {error && (
          <p className="text-sm text-destructive text-center" role="alert">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

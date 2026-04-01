"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLevelMonitor } from "@/lib/audio-level";

export interface AudioCaptureOptions {
  microphone: boolean;
  tabAudio: boolean;
  systemAudio: boolean;
}

export interface AudioCaptureState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioLevel: number;
  error: string | null;
  mediaRecorder: MediaRecorder | null;
}

export interface UseAudioCaptureReturn extends AudioCaptureState {
  startCapture: (options: AudioCaptureOptions) => Promise<void>;
  stopCapture: () => Blob | null;
  pauseCapture: () => void;
  resumeCapture: () => void;
  getAudioChunks: () => Blob[];
}

export function useAudioCapture(): UseAudioCaptureReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [recorderState, setRecorderState] = useState<MediaRecorder | null>(
    null,
  );

  const chunksRef = useRef<Blob[]>([]);
  const streamsRef = useRef<MediaStream[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const levelMonitorRef = useRef<AudioLevelMonitor | null>(null);
  const isPausedRef = useRef(false);

  const cleanup = useCallback(() => {
    levelMonitorRef.current?.stop();
    levelMonitorRef.current = null;

    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    streamsRef.current = [];

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const startCapture = useCallback(
    async (options: AudioCaptureOptions) => {
      setError(null);
      chunksRef.current = [];

      let micStream: MediaStream | null = null;
      let displayStream: MediaStream | null = null;

      // 1. Capture microphone
      if (options.microphone) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          streamsRef.current.push(micStream);
        } catch (err) {
          const domErr = err as DOMException;
          if (domErr.name === "NotAllowedError") {
            setError(
              "Microphone access denied. Please allow microphone access in your browser settings.",
            );
          } else if (domErr.name === "NotFoundError") {
            setError("No microphone found. Please connect a microphone.");
          } else {
            setError(`Recording failed: ${domErr.message}`);
          }
          return;
        }
      }

      // 2. Capture tab/system audio via getDisplayMedia
      if (options.tabAudio || options.systemAudio) {
        try {
          // Chrome requires video:true in getDisplayMedia — discard video track immediately
          displayStream = await navigator.mediaDevices.getDisplayMedia({
            audio: true,
            video: true,
          });
          displayStream.getVideoTracks().forEach((track) => track.stop());
          streamsRef.current.push(displayStream);
        } catch {
          setError(
            "Tab audio sharing was cancelled. Recording with microphone only.",
          );
          if (!micStream) {
            cleanup();
            return;
          }
          displayStream = null;
        }
      }

      if (!micStream && !displayStream) {
        setError("Recording failed: No audio sources selected.");
        return;
      }

      try {
        // 3. Set up AudioContext for mixing and level monitoring
        const AudioCtx =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;
        const audioContext = new AudioCtx();
        audioContextRef.current = audioContext;

        let finalStream: MediaStream;

        if (micStream && displayStream) {
          // Mix both streams into a single destination
          const micSource = audioContext.createMediaStreamSource(micStream);
          const displaySource =
            audioContext.createMediaStreamSource(displayStream);
          const destination = audioContext.createMediaStreamDestination();
          micSource.connect(destination);
          displaySource.connect(destination);
          finalStream = destination.stream;

          // Monitor the microphone for audio level
          const monitorSource = audioContext.createMediaStreamSource(micStream);
          levelMonitorRef.current = new AudioLevelMonitor(
            audioContext,
            monitorSource,
            setAudioLevel,
          );
        } else {
          finalStream = (micStream ?? displayStream)!;
          const source = audioContext.createMediaStreamSource(finalStream);
          levelMonitorRef.current = new AudioLevelMonitor(
            audioContext,
            source,
            setAudioLevel,
          );
        }

        // 4. Create MediaRecorder with opus codec where supported
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";

        const recorder = new MediaRecorder(finalStream, { mimeType });
        mediaRecorderRef.current = recorder;
        setRecorderState(recorder);

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        // 5. Start recording with 250ms timeslice for regular chunk delivery
        recorder.start(250);
        levelMonitorRef.current.start();

        // Duration counter — uses ref to avoid stale closure in interval
        setDuration(0);
        isPausedRef.current = false;
        durationIntervalRef.current = setInterval(() => {
          if (!isPausedRef.current) {
            setDuration((prev) => prev + 1);
          }
        }, 1000);

        setIsRecording(true);
        setIsPaused(false);
      } catch (err) {
        const e = err as Error;
        setError(`Recording failed: ${e.message}`);
        cleanup();
      }
    },
    [cleanup],
  );

  const stopCapture = useCallback((): Blob | null => {
    if (!mediaRecorderRef.current) return null;

    if (mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    for (const stream of streamsRef.current) {
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
    streamsRef.current = [];

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    levelMonitorRef.current?.stop();
    levelMonitorRef.current = null;

    if (durationIntervalRef.current !== null) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    mediaRecorderRef.current = null;
    setRecorderState(null);
    setIsRecording(false);
    setIsPaused(false);

    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    return blob;
  }, []);

  const pauseCapture = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.pause();
      isPausedRef.current = true;
      setIsPaused(true);
    }
  }, []);

  const resumeCapture = useCallback(() => {
    if (mediaRecorderRef.current?.state === "paused") {
      mediaRecorderRef.current.resume();
      isPausedRef.current = false;
      setIsPaused(false);
    }
  }, []);

  const getAudioChunks = useCallback((): Blob[] => {
    return [...chunksRef.current];
  }, []);

  // Cleanup all resources on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    isRecording,
    isPaused,
    duration,
    audioLevel,
    error,
    mediaRecorder: recorderState,
    startCapture,
    stopCapture,
    pauseCapture,
    resumeCapture,
    getAudioChunks,
  };
}

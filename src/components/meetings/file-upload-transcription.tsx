"use client";

import * as React from "react";
import { Upload, FileAudio, FileVideo, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { LiveTranscript } from "./live-transcript";
import { UploadProgress } from "./upload-progress";
import type { TranscriptSegment } from "@/lib/types/transcription";
import type { UploadStage } from "./upload-progress";
import { cn } from "@/lib/utils";

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const COMPRESS_THRESHOLD = 49 * 1024 * 1024; // Compress files over 49MB (Supabase free-tier limit is 50MB)

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".webm"];

function isAudioFile(file: File): boolean {
  const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
  return AUDIO_EXTENSIONS.includes(ext) || file.type.startsWith("audio/");
}

export interface FileUploadTranscriptionProps {
  onComplete: (data: {
    segments: TranscriptSegment[];
    audioUrl: string;
    durationSeconds: number;
    fileName: string;
  }) => void | Promise<void>;
  onDiscard: () => void;
  className?: string;
}

export function FileUploadTranscription({
  onComplete,
  onDiscard,
  className,
}: FileUploadTranscriptionProps) {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [stage, setStage] = React.useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | undefined>();
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([]);
  const [uploadedPath, setUploadedPath] = React.useState<string | null>(null);
  const [signedUrl, setSignedUrl] = React.useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = React.useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);

  const [fileQueue, setFileQueue] = React.useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const abortControllerRef = React.useRef<AbortController | null>(null);

  function handleFileSelect(file: File) {
    setFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      setFileError("File exceeds 500MB limit");
      return;
    }
    setSelectedFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Queue all files, start with the first one
      setFileQueue(Array.from(files).slice(1));
      handleFileSelect(files[0]);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setFileQueue(Array.from(files).slice(1));
      handleFileSelect(files[0]);
    }
  }

  async function handleTranscribe() {
    if (!selectedFile) return;

    const supabase = createClient();
    if (!supabase) {
      setStage("error");
      setErrorMessage("Database unavailable");
      return;
    }

    abortControllerRef.current = new AbortController();
    setUploadProgress(0);
    setErrorMessage(undefined);

    try {
      // Get user ID for storage RLS path
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // 0. Compress large files to fit under Supabase free-tier 50MB limit
      let fileToUpload: File | Blob = selectedFile;
      let uploadContentType = selectedFile.type || "audio/mpeg";
      let uploadName = selectedFile.name;

      if (selectedFile.size > COMPRESS_THRESHOLD) {
        setStage("compressing");
        const { compressAudio } = await import("@/lib/audio-compress");
        fileToUpload = await compressAudio(selectedFile, (p) => {
          setUploadProgress(p.percent);
        });
        uploadContentType = "audio/mpeg";
        uploadName = selectedFile.name.replace(/\.[^.]+$/, ".mp3");
        console.log(
          `[upload] Compressed ${(selectedFile.size / 1024 / 1024).toFixed(1)} MB → ${(fileToUpload.size / 1024 / 1024).toFixed(1)} MB`,
        );
        if (fileToUpload.size > COMPRESS_THRESHOLD) {
          throw new Error(
            `Compressed file is still ${(fileToUpload.size / 1024 / 1024).toFixed(0)} MB (limit: 49 MB). Try a shorter recording.`,
          );
        }
      }

      // 1. Upload to Supabase Storage (path must start with user ID for RLS)
      setStage("uploading");
      setUploadProgress(0);
      const timestamp = Date.now();
      const safeName = uploadName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${timestamp}_${safeName}`;

      console.log(
        `[upload] Uploading ${(fileToUpload.size / 1024 / 1024).toFixed(1)} MB as ${uploadContentType}`,
      );
      const { error: uploadError } = await supabase.storage
        .from("meeting-recordings")
        .upload(path, fileToUpload, {
          contentType: uploadContentType,
          upsert: false,
        });

      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      setUploadedPath(path);
      setUploadProgress(100);

      // 2. Get signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from("meeting-recordings")
        .createSignedUrl(path, 60 * 60 * 24); // 24-hour URL

      if (urlError || !urlData?.signedUrl) {
        throw new Error(`Failed to get file URL: ${urlError?.message}`);
      }
      setSignedUrl(urlData.signedUrl);

      // 3. Transcribe
      setStage("transcribing");

      const res = await fetch("/api/transcription/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: urlData.signedUrl }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            `Transcription failed (${res.status})`,
        );
      }

      const data = (await res.json()) as { segments?: TranscriptSegment[] };
      setSegments(data.segments ?? []);
      setStage("reviewing");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        await cleanupUploadedFile();
        setStage("idle");
        return;
      }
      setStage("error");
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function cleanupUploadedFile() {
    const pathToDelete = uploadedPath;
    if (!pathToDelete) return;
    const supabase = createClient();
    if (!supabase) return;
    await supabase.storage.from("meeting-recordings").remove([pathToDelete]);
    setUploadedPath(null);
  }

  function handleCancel() {
    abortControllerRef.current?.abort();
  }

  function handleRetry() {
    setStage("idle");
    setErrorMessage(undefined);
    setUploadProgress(0);
  }

  function handleSegmentEdit(
    index: number,
    field: "speaker" | "text",
    value: string,
  ) {
    setSegments((prev) =>
      prev.map((seg, i) => (i === index ? { ...seg, [field]: value } : seg)),
    );
  }

  function handleAudioMetadata() {
    if (audioRef.current && isFinite(audioRef.current.duration)) {
      setDurationSeconds(Math.floor(audioRef.current.duration));
    }
  }

  async function handleProcessAndSave() {
    if (!signedUrl) return;
    const dur =
      durationSeconds > 0
        ? durationSeconds
        : segments.length > 0
          ? Math.ceil(segments[segments.length - 1]!.endMs / 1000)
          : 0;
    await onComplete({
      segments,
      audioUrl: signedUrl,
      durationSeconds: dur,
      fileName: selectedFile?.name ?? "recording",
    });

    // Auto-advance to next file in queue
    if (fileQueue.length > 0) {
      const [nextFile, ...rest] = fileQueue;
      setFileQueue(rest);
      setSelectedFile(nextFile);
      setSignedUrl(null);
      setUploadedPath(null);
      setSegments([]);
      setDurationSeconds(0);
      setStage("idle");
      setUploadProgress(0);
    }
  }

  async function handleDiscard() {
    await cleanupUploadedFile();
    setSignedUrl(null);
    setSelectedFile(null);
    setSegments([]);
    setStage("idle");
    setDiscardConfirmOpen(false);
    onDiscard();
  }

  // --- Reviewing stage ---
  if (stage === "reviewing" && signedUrl) {
    return (
      <div className={cn("space-y-4", className)}>
        {/* Audio playback */}
        <div className="rounded-md border bg-muted/20 p-3">
          <audio
            ref={audioRef}
            controls
            src={signedUrl}
            onLoadedMetadata={handleAudioMetadata}
            className="w-full h-10"
            aria-label="Uploaded audio playback"
          />
        </div>

        {/* Transcript review */}
        <LiveTranscript
          segments={segments}
          onSegmentEdit={handleSegmentEdit}
          isLive={false}
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            className="text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={() => setDiscardConfirmOpen(true)}
          >
            Discard
          </Button>
          <Button onClick={handleProcessAndSave}>Process & Save</Button>
        </div>

        {/* Discard confirmation */}
        {discardConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="fixed inset-0 bg-black/50"
              onClick={() => setDiscardConfirmOpen(false)}
            />
            <div className="relative z-50 rounded-lg border bg-background p-6 shadow-lg max-w-sm w-full mx-4">
              <h3 className="text-lg font-semibold">Discard recording?</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                The uploaded file and transcript will be permanently deleted.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDiscardConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleDiscard}>
                  Discard
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- Compressing / upload / transcribing / error stage ---
  if (
    stage === "compressing" ||
    stage === "uploading" ||
    stage === "transcribing" ||
    stage === "error"
  ) {
    return (
      <div className={className}>
        <UploadProgress
          stage={stage}
          uploadProgress={uploadProgress}
          fileName={selectedFile?.name ?? ""}
          fileSize={selectedFile?.size ?? 0}
          errorMessage={errorMessage}
          onCancel={handleCancel}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  // --- Idle / file selection stage ---
  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop zone */}
      <div
        role="button"
        aria-label="Drop audio or video file here"
        tabIndex={0}
        className={cn(
          "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
      >
        <Upload className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Drop audio or video file here</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            or click to browse
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          MP3, WAV, MP4, MOV, WebM, M4A, OGG · Max 500MB
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".mp3,.wav,.mp4,.mov,.webm,.m4a,.ogg,audio/*,video/*"
          className="hidden"
          onChange={handleInputChange}
          aria-label="Select audio or video file"
        />
      </div>

      {fileError && <p className="text-sm text-destructive">{fileError}</p>}

      {/* Queue indicator */}
      {fileQueue.length > 0 && (
        <p className="text-xs text-muted-foreground">
          +{fileQueue.length} more file{fileQueue.length > 1 ? "s" : ""} queued
        </p>
      )}

      {/* Selected file info */}
      {selectedFile && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
          {isAudioFile(selectedFile) ? (
            <FileAudio className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          ) : (
            <FileVideo className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedFile(null);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {selectedFile && (
        <div className="flex justify-end">
          <Button onClick={handleTranscribe}>Transcribe</Button>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import { Check, Loader2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type UploadStage =
  | "idle"
  | "compressing"
  | "uploading"
  | "transcribing"
  | "reviewing"
  | "processing"
  | "complete"
  | "error";

export interface UploadProgressProps {
  stage: UploadStage;
  uploadProgress: number;
  fileName: string;
  fileSize: number;
  errorMessage?: string;
  onCancel: () => void;
  onRetry: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

const STAGES = [
  { key: "compressing" as const, label: "Compress" },
  { key: "uploading" as const, label: "Upload" },
  { key: "transcribing" as const, label: "Transcribe" },
  { key: "reviewing" as const, label: "Review" },
  { key: "processing" as const, label: "Process" },
];

const STAGE_ORDER: UploadStage[] = [
  "compressing",
  "uploading",
  "transcribing",
  "reviewing",
  "processing",
  "complete",
];

function getStageIndex(stage: UploadStage): number {
  return STAGE_ORDER.indexOf(stage);
}

export function UploadProgress({
  stage,
  uploadProgress,
  fileName,
  fileSize,
  errorMessage,
  onCancel,
  onRetry,
}: UploadProgressProps) {
  const currentIndex = getStageIndex(stage);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      {/* File info */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(fileSize)}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-1">
        {STAGES.map((s, i) => {
          const stageIndex = STAGE_ORDER.indexOf(s.key);
          const isDone = currentIndex > stageIndex && stage !== "error";
          const isCurrent =
            currentIndex === stageIndex &&
            stage !== "error" &&
            stage !== "complete";
          const isError = stage === "error" && currentIndex === stageIndex;

          return (
            <React.Fragment key={s.key}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors",
                    isDone && "bg-green-500 border-green-500 text-white",
                    isCurrent && "border-primary text-primary",
                    isError &&
                      "bg-destructive border-destructive text-destructive-foreground",
                    !isDone &&
                      !isCurrent &&
                      !isError &&
                      "border-muted text-muted-foreground",
                  )}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isError ? (
                    <X className="h-3.5 w-3.5" />
                  ) : isCurrent &&
                    (s.key === "compressing" ||
                      s.key === "transcribing" ||
                      s.key === "processing") ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    isDone && "text-green-600 dark:text-green-400",
                    isCurrent && "text-primary",
                    !isDone && !isCurrent && "text-muted-foreground",
                  )}
                >
                  {s.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mb-4 transition-colors",
                    currentIndex > stageIndex && stage !== "error"
                      ? "bg-green-500"
                      : "bg-muted",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Compressing state */}
      {stage === "compressing" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Compressing audio for upload...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} aria-label="Compression progress" />
        </div>
      )}

      {/* Upload progress bar */}
      {stage === "uploading" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Uploading...</span>
            <span>{uploadProgress}%</span>
          </div>
          <Progress value={uploadProgress} aria-label="Upload progress" />
        </div>
      )}

      {/* Transcribing state */}
      {stage === "transcribing" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Transcribing audio...</span>
        </div>
      )}

      {/* Processing state */}
      {stage === "processing" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Processing with Claude AI...</span>
        </div>
      )}

      {/* Error state */}
      {stage === "error" && errorMessage && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 space-y-2">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {/* Cancel button */}
      {(stage === "compressing" ||
        stage === "uploading" ||
        stage === "transcribing") && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="w-full text-muted-foreground"
        >
          Cancel
        </Button>
      )}
    </div>
  );
}

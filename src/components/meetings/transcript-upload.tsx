"use client";

import * as React from "react";
import { Upload, Loader2, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createMeetingFromTranscript } from "@/lib/actions/meetings";

interface TranscriptUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ProcessingStep =
  | "idle"
  | "reading"
  | "analyzing"
  | "saving"
  | "done"
  | "error";

export function TranscriptUpload({
  open,
  onOpenChange,
}: TranscriptUploadProps) {
  const [step, setStep] = React.useState<ProcessingStep>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<{
    title: string;
    summary: string;
    taskCount: number;
    durationMinutes: number;
    speakers: string[];
  } | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  function reset() {
    setStep("idle");
    setError(null);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".txt")) {
      setError("Please upload a .txt transcript file");
      return;
    }

    setError(null);
    setStep("reading");

    try {
      const transcript = await file.text();

      setStep("analyzing");
      const res = await fetch("/api/meetings/process-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, filename: file.name }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to process transcript");
      }

      const data = await res.json();

      setPreview({
        title: data.title,
        summary: data.summary,
        taskCount: data.tasks.length,
        durationMinutes: data.metadata.durationMinutes,
        speakers: data.metadata.speakers,
      });

      setStep("saving");

      const result = await createMeetingFromTranscript({
        title: data.title,
        summary: data.summary,
        tasks: data.tasks,
        durationMinutes: data.metadata.durationMinutes,
        speakers: data.metadata.speakers,
        meetingDate: data.metadata.meetingDate,
        rawTranscript: data.rawTranscript,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setStep("done");
      toast.success("Meeting processed", {
        description: `Created meeting with ${data.tasks.length} tasks and logged ${data.metadata.durationMinutes}min to timesheet.`,
      });

      setTimeout(() => {
        onOpenChange(false);
        reset();
      }, 1500);
    } catch (err) {
      setStep("error");
      setError(err instanceof Error ? err.message : "Unknown error");
      toast.error("Failed to process transcript");
    }
  }

  const stepLabels: Record<ProcessingStep, string> = {
    idle: "",
    reading: "Reading transcript file...",
    analyzing: "Analyzing with Claude AI (this may take 15-30s)...",
    saving: "Creating meeting, tasks, and timesheet entry...",
    done: "Done!",
    error: "Failed",
  };

  const isProcessing = step !== "idle" && step !== "done" && step !== "error";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!isProcessing) {
          onOpenChange(v);
          if (!v) reset();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Process Meeting Transcript
          </DialogTitle>
          <DialogDescription>
            Upload a transcribed meeting recording (.txt). Claude AI will
            extract work-only notes, create tasks, and log the time to your
            timesheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File input */}
          {step === "idle" && (
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary hover:bg-muted/50">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Drop a transcript file here or click to browse
              </span>
              <span className="text-xs text-muted-foreground">
                SRT format with speaker labels (e.g. from Otter.ai, Fireflies)
              </span>
              <input
                ref={fileRef}
                type="file"
                accept=".txt"
                className="hidden"
                onChange={handleFileSelect}
              />
            </label>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">{stepLabels[step]}</p>
            </div>
          )}

          {/* Success preview */}
          {step === "done" && preview && (
            <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-600">
                  Successfully processed!
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <p>
                  <strong>Title:</strong> {preview.title}
                </p>
                <p>
                  <strong>Duration:</strong> {preview.durationMinutes} minutes
                </p>
                <p>
                  <strong>Attendees:</strong> {preview.speakers.join(", ")}
                </p>
                <p>
                  <strong>Tasks created:</strong> {preview.taskCount}
                </p>
                <p>
                  <strong>Timesheet:</strong> {preview.durationMinutes}min
                  logged
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              {step === "error" && (
                <Button variant="outline" onClick={reset}>
                  Try Again
                </Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

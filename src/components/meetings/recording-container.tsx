"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeepgramClient } from "@deepgram/sdk";
import { Button } from "@/components/ui/button";
import { RecordingPanel } from "./recording-panel";
import { LiveTranscript } from "./live-transcript";
import { processRecordingAction } from "@/lib/actions/recording";
import { linkMeetingToEventAction } from "@/lib/actions/calendar";
import type { TranscriptSegment } from "@/lib/types/transcription";
import type { MeetingPreFillData } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RecordingContainerProps {
  onComplete?: () => void;
  onDiscard: () => void;
  className?: string;
  /** Pre-fill data from a calendar event — links the recording to that event after save */
  prefillData?: MeetingPreFillData | null;
}

type Phase = "setup" | "recording" | "review" | "saving";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DeepgramConnection = any;

export function RecordingContainer({
  onComplete,
  onDiscard,
  className,
  prefillData,
}: RecordingContainerProps) {
  const router = useRouter();
  const [phase, setPhase] = React.useState<Phase>("setup");
  const [segments, setSegments] = React.useState<TranscriptSegment[]>([]);
  const [audioBlob, setAudioBlob] = React.useState<Blob | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = React.useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = React.useState(0);
  const [discardConfirmOpen, setDiscardConfirmOpen] = React.useState(false);

  const connectionRef = React.useRef<DeepgramConnection | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  // Revoke blob URL on unmount
  React.useEffect(() => {
    return () => {
      if (audioBlobUrl) URL.revokeObjectURL(audioBlobUrl);
    };
  }, [audioBlobUrl]);

  async function handleRecordingStart() {
    setPhase("recording");
    setSegments([]);
    startTimeRef.current = Date.now();

    try {
      const res = await fetch("/api/transcription/token", { method: "POST" });
      if (!res.ok) return;
      const { key } = (await res.json()) as { key: string };

      const deepgram = new DeepgramClient({ key });
      const connection = deepgram.listen.live({
        model: "nova-3",
        smart_format: true,
        diarize: true,
        punctuate: true,
        utterances: true,
        interim_results: false,
      });

      connection.on(
        "message",
        (data: {
          channel?: {
            alternatives?: Array<{
              transcript?: string;
              confidence?: number;
              words?: Array<{
                start: number;
                end: number;
                word: string;
                speaker?: number;
              }>;
            }>;
          };
        }) => {
          const alt = data?.channel?.alternatives?.[0];
          if (!alt?.transcript?.trim()) return;

          const words = alt.words ?? [];
          const startMs =
            words.length > 0 ? Math.round(words[0].start * 1000) : 0;
          const endMs =
            words.length > 0
              ? Math.round(words[words.length - 1].end * 1000)
              : 0;
          const speaker =
            words.length > 0 && words[0].speaker !== undefined
              ? `Speaker ${words[0].speaker + 1}`
              : "Speaker 1";

          const segment: TranscriptSegment = {
            text: alt.transcript,
            startMs,
            endMs,
            speaker,
            confidence: alt.confidence ?? 0,
          };

          setSegments((prev) => [...prev, segment]);
        },
      );

      connectionRef.current = connection;
    } catch {
      // Continue recording without live transcription if setup fails
    }
  }

  function handleChunk(chunk: Blob) {
    if (!connectionRef.current) return;
    try {
      connectionRef.current.send(chunk);
    } catch {
      // Ignore send errors — connection may have closed
    }
  }

  function handleAudioData(chunks: Blob[]) {
    const elapsed =
      startTimeRef.current !== null
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;
    setDurationSeconds(elapsed);

    const blob = new Blob(chunks, { type: "audio/webm" });
    const url = URL.createObjectURL(blob);
    setAudioBlob(blob);
    setAudioBlobUrl(url);

    if (connectionRef.current) {
      try {
        connectionRef.current.finish();
      } catch {
        // ignore
      }
      connectionRef.current = null;
    }

    setPhase("review");
  }

  function handleSegmentEdit(
    index: number,
    field: "speaker" | "text",
    value: string,
  ) {
    setSegments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  async function handleSave() {
    if (!audioBlob) return;
    setPhase("saving");

    const formData = new FormData();
    formData.append("segments", JSON.stringify(segments));
    formData.append("audio", audioBlob, "recording.webm");
    formData.append("duration", String(durationSeconds));

    // Pass pre-fill metadata so the recording service can set the CRM customer
    if (prefillData?.crm_customer_id) {
      formData.append("crm_customer_id", prefillData.crm_customer_id);
    }

    const result = await processRecordingAction(formData);

    if ("error" in result) {
      setPhase("review");
      toast.error(`Processing failed: ${result.error}`);
      return;
    }

    // Link the completed meeting back to its calendar event
    if (prefillData?.source_event_id) {
      await linkMeetingToEventAction(
        result.meetingId,
        prefillData.source_event_id,
      );
    }

    toast.success("Recording processed successfully");
    onComplete?.();
    router.push("/meetings");
  }

  function handleDiscard() {
    setDiscardConfirmOpen(false);
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl(null);
    }
    onDiscard();
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Setup phase: RecordingPanel in idle state */}
      {phase === "setup" && (
        <RecordingPanel
          onAudioData={handleAudioData}
          onTranscriptUpdate={() => {}}
          onRecordingStart={handleRecordingStart}
          onChunk={handleChunk}
        />
      )}

      {/* Recording phase: panel + live transcript */}
      {phase === "recording" && (
        <>
          <RecordingPanel
            onAudioData={handleAudioData}
            onTranscriptUpdate={() => {}}
            onRecordingStart={handleRecordingStart}
            onChunk={handleChunk}
          />
          <LiveTranscript
            segments={segments}
            onSegmentEdit={handleSegmentEdit}
            isLive={true}
          />
        </>
      )}

      {/* Review phase: audio playback + editable transcript */}
      {phase === "review" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-lg">Review Recording</h3>

          {audioBlobUrl && (
            <audio controls src={audioBlobUrl} className="w-full" />
          )}

          <LiveTranscript
            segments={segments}
            onSegmentEdit={handleSegmentEdit}
            isLive={false}
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              onClick={() => setDiscardConfirmOpen(true)}
            >
              Discard
            </Button>
            <Button onClick={handleSave}>Save &amp; Process</Button>
          </div>
        </div>
      )}

      {/* Saving phase */}
      {phase === "saving" && (
        <div className="flex items-center justify-center py-12 gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-muted-foreground">Processing recording...</span>
        </div>
      )}

      {/* Discard confirmation dialog */}
      {discardConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setDiscardConfirmOpen(false)}
          />
          <div className="relative z-50 rounded-lg border bg-background p-6 shadow-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold">Discard recording?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Are you sure? This recording will be lost.
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

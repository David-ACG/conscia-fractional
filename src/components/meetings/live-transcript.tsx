"use client";

import * as React from "react";
import type { TranscriptSegment } from "@/lib/types/transcription";
import { cn } from "@/lib/utils";

interface LiveTranscriptProps {
  segments: TranscriptSegment[];
  onSegmentEdit: (
    index: number,
    field: "speaker" | "text",
    value: string,
  ) => void;
  isLive: boolean;
  className?: string;
}

const SPEAKER_COLORS = [
  "text-blue-600 dark:text-blue-400",
  "text-green-600 dark:text-green-400",
  "text-purple-600 dark:text-purple-400",
  "text-orange-600 dark:text-orange-400",
  "text-pink-600 dark:text-pink-400",
  "text-teal-600 dark:text-teal-400",
  "text-red-600 dark:text-red-400",
  "text-indigo-600 dark:text-indigo-400",
];

function hashSpeaker(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % SPEAKER_COLORS.length;
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (totalSeconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export function LiveTranscript({
  segments,
  onSegmentEdit,
  isLive,
  className,
}: LiveTranscriptProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [editingSpeaker, setEditingSpeaker] = React.useState<number | null>(
    null,
  );
  const [editingText, setEditingText] = React.useState<number | null>(null);
  const [speakerValue, setSpeakerValue] = React.useState("");
  const [textValue, setTextValue] = React.useState("");

  // Auto-scroll to bottom during live recording
  React.useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [segments, isLive]);

  function startEditSpeaker(index: number) {
    setEditingSpeaker(index);
    setSpeakerValue(segments[index].speaker);
  }

  function commitSpeakerEdit(index: number) {
    const oldSpeaker = segments[index].speaker;
    const newSpeaker = speakerValue.trim() || oldSpeaker;
    // Batch rename: update all segments with the same speaker name
    segments.forEach((seg, i) => {
      if (seg.speaker === oldSpeaker) {
        onSegmentEdit(i, "speaker", newSpeaker);
      }
    });
    setEditingSpeaker(null);
  }

  function startEditText(index: number) {
    if (isLive) return;
    setEditingText(index);
    setTextValue(segments[index].text);
  }

  function commitTextEdit(index: number) {
    onSegmentEdit(index, "text", textValue);
    setEditingText(null);
  }

  return (
    <div
      ref={scrollRef}
      className={cn(
        "max-h-[400px] overflow-y-auto space-y-2 p-4 rounded-md border bg-muted/20",
        className,
      )}
    >
      {segments.length === 0 ? (
        <div className="flex items-center justify-center h-24">
          {isLive ? (
            <span
              className="animate-pulse text-sm text-muted-foreground"
              aria-live="polite"
            >
              Waiting for speech...
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              No transcript available.
            </span>
          )}
        </div>
      ) : (
        segments.map((segment, index) => {
          const colorClass = SPEAKER_COLORS[hashSpeaker(segment.speaker)];
          return (
            <div key={index} className="flex gap-3 items-start text-sm">
              {/* Speaker label */}
              <div className="flex-shrink-0 w-24">
                {editingSpeaker === index ? (
                  <input
                    autoFocus
                    className="w-full bg-background border rounded px-1 py-0.5 text-xs font-bold"
                    value={speakerValue}
                    onChange={(e) => setSpeakerValue(e.target.value)}
                    onBlur={() => commitSpeakerEdit(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSpeakerEdit(index);
                      if (e.key === "Escape") setEditingSpeaker(null);
                    }}
                    aria-label="Edit speaker name"
                  />
                ) : (
                  <button
                    className={cn(
                      "font-bold text-left hover:underline cursor-pointer text-xs w-full truncate",
                      colorClass,
                    )}
                    onClick={() => startEditSpeaker(index)}
                    title="Click to rename speaker"
                  >
                    {segment.speaker}
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <span className="flex-shrink-0 text-muted-foreground text-xs mt-0.5 tabular-nums">
                {formatMs(segment.startMs)}
              </span>

              {/* Transcript text */}
              <div className="flex-1">
                {editingText === index ? (
                  <textarea
                    autoFocus
                    className="w-full bg-background border rounded px-2 py-1 text-sm resize-none"
                    value={textValue}
                    rows={2}
                    onChange={(e) => setTextValue(e.target.value)}
                    onBlur={() => commitTextEdit(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitTextEdit(index);
                      }
                      if (e.key === "Escape") setEditingText(null);
                    }}
                    aria-label="Edit transcript text"
                  />
                ) : (
                  <p
                    className={cn(
                      !isLive &&
                        "cursor-pointer hover:bg-muted rounded px-1 -mx-1",
                    )}
                    onClick={() => startEditText(index)}
                    title={!isLive ? "Click to edit" : undefined}
                  >
                    {segment.text}
                  </p>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

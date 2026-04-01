"use client";

import { useTimer } from "./timer-provider";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

interface TimerDisplayProps {
  className?: string;
  size?: "sm" | "lg";
}

export function TimerDisplay({ className, size = "sm" }: TimerDisplayProps) {
  const { isRunning, elapsedSeconds } = useTimer();

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        {isRunning && (
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
        )}
        <span
          className={
            size === "lg"
              ? "font-mono text-3xl font-bold tabular-nums"
              : "font-mono text-lg font-semibold tabular-nums"
          }
        >
          {formatElapsed(elapsedSeconds)}
        </span>
      </div>
    </div>
  );
}

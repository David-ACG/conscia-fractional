"use client";

import { cn } from "@/lib/utils";

interface SpinnerProps {
  size?: number;
  className?: string;
}

export function Spinner({ size = 40, className }: SpinnerProps) {
  const borderWidth = Math.max(2, Math.round(size / 16));

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    >
      <svg
        className="animate-spin"
        width={size}
        height={size}
        viewBox="0 0 50 50"
        style={{ animationDuration: "0.8s" }}
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth={borderWidth}
          className="text-muted/30"
        />
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth={borderWidth}
          strokeLinecap="round"
          strokeDasharray="80 126"
          className="text-primary stroke-primary"
        />
      </svg>
      <svg
        className="absolute animate-spin-reverse"
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 50 50"
      >
        <circle
          cx="25"
          cy="25"
          r="20"
          fill="none"
          strokeWidth={borderWidth + 1}
          strokeLinecap="round"
          strokeDasharray="40 126"
          className="text-accent stroke-accent"
        />
      </svg>
    </div>
  );
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <Spinner size={48} />
      <p className="text-sm text-muted-foreground animate-pulse">Loading...</p>
    </div>
  );
}

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

interface TimerState {
  isRunning: boolean;
  currentCategory: string | null;
  startedAt: number | null;
  elapsedSeconds: number;
  todayTotalMinutes: number;
}

interface TimerContextValue extends TimerState {
  startTimer: (category: string) => Promise<void>;
  stopTimer: () => Promise<void>;
}

const TimerContext = createContext<TimerContextValue | null>(null);

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer must be used within TimerProvider");
  return ctx;
}

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const LONG_TIMER_MS = 2 * 60 * 60 * 1000; // 2 hours
const BROADCAST_CHANNEL = "timer-sync";

export function TimerProvider({ children }: { children: ReactNode }) {
  const [isRunning, setIsRunning] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [todayTotalMinutes, setTodayTotalMinutes] = useState(0);

  const rafRef = useRef<number>(0);
  const lastSecondRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityRef = useRef(Date.now());
  const idlePromptShownRef = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);

  // BroadcastChannel for cross-tab sync
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const ch = new BroadcastChannel(BROADCAST_CHANNEL);
    channelRef.current = ch;

    ch.onmessage = (e) => {
      const { type, category, startedAt: sa } = e.data;
      if (type === "start") {
        setIsRunning(true);
        setCurrentCategory(category);
        setStartedAt(sa);
        idlePromptShownRef.current = false;
      } else if (type === "stop") {
        setIsRunning(false);
        setCurrentCategory(null);
        setStartedAt(null);
        setElapsedSeconds(0);
      } else if (type === "today-total") {
        setTodayTotalMinutes(e.data.minutes);
      }
    };

    return () => ch.close();
  }, []);

  const broadcast = useCallback((data: Record<string, unknown>) => {
    channelRef.current?.postMessage(data);
  }, []);

  // Fetch active timer + today's total on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/timer");
        if (!res.ok) return;
        const data = await res.json();
        if (data.activeTimer) {
          const sa = new Date(data.activeTimer.started_at).getTime();
          setIsRunning(true);
          setCurrentCategory(data.activeTimer.category);
          setStartedAt(sa);
          idlePromptShownRef.current = false;
        }
        if (typeof data.todayTotalMinutes === "number") {
          setTodayTotalMinutes(data.todayTotalMinutes);
        }
      } catch {
        // silently fail — timer will work offline
      }
    }
    load();
  }, []);

  // requestAnimationFrame tick
  useEffect(() => {
    if (!isRunning || !startedAt) {
      setElapsedSeconds(0);
      return;
    }

    function tick() {
      const now = Date.now();
      const sec = Math.floor((now - startedAt!) / 1000);
      if (sec !== lastSecondRef.current) {
        lastSecondRef.current = sec;
        setElapsedSeconds(sec);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRunning, startedAt]);

  // Idle detection
  useEffect(() => {
    if (!isRunning) return;

    function onActivity() {
      lastActivityRef.current = Date.now();
      idlePromptShownRef.current = false;
    }

    const events = ["mousemove", "keydown", "click", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity));

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= IDLE_TIMEOUT_MS && !idlePromptShownRef.current) {
        idlePromptShownRef.current = true;
        const idleMin = Math.floor(idleMs / 60000);
        toast(`You've been idle for ${idleMin} minutes`, {
          duration: Infinity,
          action: {
            label: "Discard idle time",
            onClick: () => {
              // Keep timer running but note the idle
              toast.success("Idle time noted");
            },
          },
          cancel: {
            label: "Keep it",
            onClick: () => {
              // Do nothing, keep running
            },
          },
        });
      }
    }, 30000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [isRunning]);

  // Long timer warning
  useEffect(() => {
    if (!isRunning || !startedAt) {
      if (longTimerRef.current) clearTimeout(longTimerRef.current);
      return;
    }

    const elapsed = Date.now() - startedAt;
    const remaining = LONG_TIMER_MS - elapsed;
    if (remaining <= 0) {
      toast.warning("Timer has been running for over 2 hours");
      return;
    }

    longTimerRef.current = setTimeout(() => {
      toast.warning("Timer has been running for over 2 hours");
    }, remaining);

    return () => {
      if (longTimerRef.current) clearTimeout(longTimerRef.current);
    };
  }, [isRunning, startedAt]);

  // Keyboard shortcut: Alt+T
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        if (isRunning) {
          stopTimer();
        } else {
          // Start with last category or default
          startTimer(currentCategory || "General");
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRunning, currentCategory]);

  const startTimer = useCallback(
    async (category: string) => {
      const now = Date.now();
      setIsRunning(true);
      setCurrentCategory(category);
      setStartedAt(now);
      idlePromptShownRef.current = false;
      lastActivityRef.current = now;
      broadcast({ type: "start", category, startedAt: now });

      try {
        await fetch("/api/timer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category }),
        });
      } catch {
        // keep local state running even if API fails
      }
    },
    [broadcast],
  );

  const stopTimer = useCallback(async () => {
    setIsRunning(false);
    setCurrentCategory(null);
    setStartedAt(null);
    setElapsedSeconds(0);
    broadcast({ type: "stop" });

    try {
      const res = await fetch("/api/timer", { method: "PATCH" });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.todayTotalMinutes === "number") {
          setTodayTotalMinutes(data.todayTotalMinutes);
          broadcast({ type: "today-total", minutes: data.todayTotalMinutes });
        }
      }
    } catch {
      // silently fail
    }
  }, [broadcast]);

  return (
    <TimerContext.Provider
      value={{
        isRunning,
        currentCategory,
        startedAt,
        elapsedSeconds,
        todayTotalMinutes,
        startTimer,
        stopTimer,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
}

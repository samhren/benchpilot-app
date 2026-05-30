"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Rest-timer state, including the full-timer overlay flag and best-effort
 * localStorage persistence so an in-progress rest survives a tab eviction.
 *
 * `now` is the shared 1s ticker from the orchestrator; `beep` is the audio cue
 * fired once when the countdown reaches zero. Both are passed in so the timer
 * effects stay in lockstep with the rest of the screen (same firing cadence).
 *
 * The localStorage usage here is the in-session resilience explicitly allowed
 * by CLAUDE.md — the server remains the source of truth.
 */
export function useRestTimer({
  sessionId,
  now,
  beep,
}: {
  sessionId: string;
  now: number;
  beep: () => void;
}) {
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [restTotal, setRestTotal] = useState<number>(0);
  const beepedForRef = useRef<number | null>(null);
  const restStorageKey = `bp:rest:${sessionId}`;
  const [showFullTimer, setShowFullTimer] = useState(false);

  // Keep the beep cue in a ref so the expiry effect can fire it without taking
  // `beep` as a dependency — preserving the original effect's deps/cadence.
  const beepRef = useRef(beep);
  beepRef.current = beep;

  useEffect(() => {
    // Restore a rest timer if one was in progress (e.g. tab was evicted).
    try {
      const raw = localStorage.getItem(restStorageKey);
      if (!raw) return;
      const { endsAt, total } = JSON.parse(raw) as { endsAt: number; total: number };
      if (typeof endsAt !== "number" || endsAt <= Date.now()) {
        localStorage.removeItem(restStorageKey);
        return;
      }
      setRestEndsAt(endsAt);
      setRestTotal(total);
    } catch {}
  }, [restStorageKey]);

  const restRunning = restEndsAt !== null && restEndsAt > now;
  const restRemaining = restEndsAt ? Math.max(0, Math.ceil((restEndsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (restEndsAt === null) return;
    if (now >= restEndsAt && beepedForRef.current !== restEndsAt) {
      beepedForRef.current = restEndsAt;
      beepRef.current();
      try { localStorage.removeItem(restStorageKey); } catch {}
      setRestEndsAt(null);
    }
  }, [now, restEndsAt, restStorageKey]);

  function startRest(sec: number) {
    const endsAt = Date.now() + sec * 1000;
    setRestTotal(sec);
    setRestEndsAt(endsAt);
    try { localStorage.setItem(restStorageKey, JSON.stringify({ endsAt, total: sec })); } catch {}
  }
  function addRest(sec: number) {
    setRestEndsAt((e) => {
      if (e === null) return e;
      const ne = e + sec * 1000;
      setRestTotal((t) => {
        const nt = t + sec;
        try { localStorage.setItem(restStorageKey, JSON.stringify({ endsAt: ne, total: nt })); } catch {}
        return nt;
      });
      return ne;
    });
  }
  function clearRest() {
    setRestEndsAt(null);
    try { localStorage.removeItem(restStorageKey); } catch {}
  }

  return {
    restStorageKey,
    restTotal,
    restRunning,
    restRemaining,
    showFullTimer,
    setShowFullTimer,
    setRestEndsAt,
    startRest,
    addRest,
    clearRest,
  };
}

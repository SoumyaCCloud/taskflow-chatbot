'use client';

import { useEffect, useState } from 'react';

/** "12s" while under a minute, "1m 04s" past it — Claude's own tool-call clock does the same. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/**
 * Ticks once a second while `endedAt` is unset, then freezes on the final
 * duration. `startedAt: null` means "nothing timed yet" — returns null
 * rather than a misleading "0s" so callers render nothing until there's an
 * actual start to measure from.
 */
export function useElapsed(startedAt: number | null, endedAt?: number | null): string | null {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || endedAt != null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, endedAt]);

  if (startedAt === null) return null;
  return formatElapsed((endedAt ?? now) - startedAt);
}

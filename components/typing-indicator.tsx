'use client';

import { motion, useReducedMotion } from 'motion/react';

import { useElapsed } from '@/lib/format-elapsed';

/*
 * Replaces the animate-pulse emoji placeholder. Three dots on the same card
 * surface as a real assistant bubble, so the answer appears to arrive in place
 * rather than swapping one shape for another. `startedAt` adds the running
 * "Thinking for Xs" clock Claude shows alongside its own equivalent — the
 * dots alone don't say whether this has been 2 seconds or 20.
 */
export function TypingIndicator({ startedAt }: { startedAt: number | null }) {
  // globals.css drops CSS transitions under reduced motion, but Motion's JS
  // animations opt out separately — hold the dots still instead.
  const reduced = useReducedMotion();
  const elapsed = useElapsed(startedAt);

  return (
    <div className="flex items-center gap-2.5 rounded-3xl rounded-bl-lg border border-border-subtle bg-bg-700 px-5 py-4 shadow-card">
      {/* Static rather than live-updating: an aria-live region ticking every
          second would be read out constantly, which is noise, not help. */}
      <span className="sr-only">Assistant is thinking…</span>
      <div className="flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="size-1.5 rounded-full bg-text-300"
            animate={reduced ? { opacity: 0.6 } : { opacity: [0.25, 1, 0.25], y: [0, -3, 0] }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 1.1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }
            }
          />
        ))}
      </div>
      {elapsed && (
        <span aria-hidden="true" className="text-xs text-text-300">
          Thinking for {elapsed}
        </span>
      )}
    </div>
  );
}

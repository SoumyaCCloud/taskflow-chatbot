'use client';

import { motion, useReducedMotion } from 'motion/react';

/*
 * Replaces the animate-pulse emoji placeholder. Three dots on the same card
 * surface as a real assistant bubble, so the answer appears to arrive in place
 * rather than swapping one shape for another.
 */
export function TypingIndicator() {
  // globals.css drops CSS transitions under reduced motion, but Motion's JS
  // animations opt out separately — hold the dots still instead.
  const reduced = useReducedMotion();

  return (
    <div className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg border border-border-subtle bg-bg-700 px-5 py-4 shadow-card">
      <span className="sr-only">Assistant is typing…</span>
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
  );
}

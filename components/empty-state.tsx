'use client';

import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { useSyncExternalStore } from 'react';

import { useUserName } from '@/components/shell-user-provider';
import { firstNameFrom } from '@/lib/shell-user';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

/*
 * The greeting depends on the viewer's local clock and the server has no idea
 * what that is — deriving it server-side would hand an IST user "Good Morning"
 * at 8pm, since Vercel runs UTC. useSyncExternalStore takes an explicit server
 * snapshot, so hydration is correct by construction rather than patched up
 * afterwards. Nothing changes the value once mounted, hence the no-op subscribe.
 */
const subscribeToNothing = () => () => {};
const readGreeting = () => greetingForHour(new Date().getHours());
const readServerGreeting = () => null;

/*
 * Holds the heading's line box for the one frame before the greeting resolves.
 * The character below is U+00A0, not a space — a plain space collapses to zero
 * height and the heading jumps when the greeting lands. It is invisible in a
 * diff, so it lives in a named constant: if an editor ever flattens it back to
 * an ordinary space, this is the single line to check.
 */
const NBSP = ' ';

export function EmptyState() {
  const firstName = firstNameFrom(useUserName());

  const greeting = useSyncExternalStore<string | null>(
    subscribeToNothing,
    readGreeting,
    readServerGreeting,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="mb-8 flex flex-col items-center text-center"
    >
      <div className="mb-4 grid size-12 place-items-center rounded-full border border-accent/25 bg-accent-bg text-accent-hover shadow-glow">
        <Sparkles size={22} strokeWidth={1.5} />
      </div>

      <h1 className="text-3xl font-semibold tracking-tight text-text-100 wrap-break-word">
        {greeting ? `${greeting}${firstName ? `, ${firstName}` : ''}` : NBSP}
      </h1>

      <p className="mt-2 text-base text-text-200">What&apos;s on your mind?</p>
    </motion.div>
  );
}

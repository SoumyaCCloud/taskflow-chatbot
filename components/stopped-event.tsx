'use client';

import { CircleStop } from 'lucide-react';
import { motion } from 'motion/react';

/*
 * What a `stopped` event renders as: distinct from both the answer bubble and
 * the error banner, since this isn't a failure — it's the turn ending because
 * someone asked it to.
 */
export function StoppedEvent({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start pl-10"
    >
      <div className="flex max-w-[85%] items-center gap-2 rounded-2xl border border-status-amber/40 bg-amber-bg px-4 py-2.5 text-sm text-status-amber">
        <CircleStop size={16} strokeWidth={2} className="shrink-0" />
        <span>{message}</span>
      </div>
    </motion.div>
  );
}

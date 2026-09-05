'use client';

import { CircleAlert } from 'lucide-react';
import { motion } from 'motion/react';

import { AssistantAvatar } from '@/components/assistant-avatar';

/*
 * A turn that failed. Kept as a permanent entry in the transcript rather than
 * a transient "current error" banner that used to vanish the instant another
 * message was sent — a user re-reading the conversation should still be able
 * to see what went wrong three messages ago, not just whatever's most recent.
 */
export function ErrorEvent({ message }: { message: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-end justify-start gap-2.5"
    >
      <AssistantAvatar />
      <div className="flex max-w-[85%] items-start gap-2.5 rounded-3xl rounded-bl-lg border border-status-red/40 bg-red-bg px-5 py-4 text-sm text-status-red">
        <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
        <span className="whitespace-pre-wrap">{message}</span>
      </div>
    </motion.div>
  );
}

'use client';

import { ChevronRight, Lightbulb } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

/*
 * The model "thinking out loud" on a step that went on to call a tool.
 * Collapsed by default behind a "Thought process" toggle — same pattern
 * Claude uses for its own reasoning — so it never competes with the answer
 * bubble for attention, but stays one click away for anyone curious why the
 * agent did what it did.
 */
export function ReasoningEvent({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start pl-10"
    >
      <div className="flex max-w-[85%] flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          title={open ? 'Hide thought process' : 'Show thought process'}
          className="flex cursor-pointer items-center gap-2 rounded-full border border-border-subtle bg-bg-800 px-3 py-1.5 text-xs text-text-200 transition-colors hover:bg-bg-700"
        >
          <Lightbulb size={13} strokeWidth={2} className="shrink-0 text-status-amber" />
          <span>Thought process</span>
          <ChevronRight
            size={12}
            strokeWidth={2}
            className={`shrink-0 text-text-300 transition-transform ${open ? 'rotate-90' : ''}`}
          />
        </button>

        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.15 }}
            className="w-full overflow-hidden rounded-xl border border-border-subtle bg-bg-800 px-3 py-2 text-xs italic text-text-200"
          >
            <span className="whitespace-pre-wrap">{text}</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

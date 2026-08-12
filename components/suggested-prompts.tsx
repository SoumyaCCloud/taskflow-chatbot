'use client';

import { motion } from 'motion/react';

/*
 * Starters shown under the composer on an empty chat. These reference project
 * data the assistant cannot reach yet — app/api/chat/route.ts is a plain model
 * call with no tools — so they will not return real tasks until it is wired up.
 */
const SUGGESTIONS = [
  "What's my agenda today?",
  'Show me my archivable tasks',
  'Show me my todo tasks',
];

type SuggestedPromptsProps = {
  onPick: (prompt: string) => void;
  disabled: boolean;
};

export function SuggestedPrompts({ onPick, disabled }: SuggestedPromptsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="mt-4 flex flex-wrap justify-center gap-2"
    >
      {SUGGESTIONS.map((prompt, i) => (
        <motion.button
          key={prompt}
          type="button"
          disabled={disabled}
          onClick={() => onPick(prompt)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
          className="rounded-full border border-border-subtle bg-bg-700 px-4 py-2 text-sm text-text-200 shadow-card hover:border-accent/40 hover:bg-bg-600 hover:text-text-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {prompt}
        </motion.button>
      ))}
    </motion.div>
  );
}

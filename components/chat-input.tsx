'use client';

import { ArrowRight } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { FormEvent } from 'react';

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
};

export function ChatInput({ value, onChange, onSubmit, disabled }: ChatInputProps) {
  // The arrow only appears once there is something to send.
  const hasPrompt = value.trim().length > 0;

  return (
    <form onSubmit={onSubmit} className="relative">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ask about your project..."
        className="composer-input w-full rounded-full border-none bg-bg-600 py-4 pl-6 pr-14 text-text-100 placeholder:text-text-300 shadow-card focus:shadow-glow"
      />
      {/* Inset from the edges rather than translate-centred: motion writes an
          inline transform for the scale tween and would clobber a translate. */}
      <AnimatePresence initial={false}>
        {hasPrompt && (
          <motion.button
            type="submit"
            disabled={disabled}
            aria-label="Send message"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-2 top-2 bottom-2 grid aspect-square place-items-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:bg-bg-500 disabled:text-text-300"
          >
            <ArrowRight className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </form>
  );
}

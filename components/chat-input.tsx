'use client';

import { ArrowRight, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, type KeyboardEvent, type SubmitEvent } from 'react';

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading: boolean;
};

// Grows with the content up to this height, then scrolls internally instead
// of pushing the rest of the page around — same cap most chat UIs use.
const MAX_HEIGHT_PX = 200;

export function ChatInput({ value, onChange, onSubmit, onStop, isLoading }: ChatInputProps) {
  const hasPrompt = value.trim().length > 0;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Re-measured on every value change — typing, pasting, a suggestion chip
  // filling it, clearing after send — not just on keystrokes, so every path
  // that changes the text resizes the box the same way.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter drops a line instead, same split every other
    // chat UI uses. isComposing is checked so confirming an IME suggestion
    // with Enter doesn't also submit the message.
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  return (
    <form onSubmit={onSubmit}>
      {/* The border, background and shadow live on this shell rather than on
          the textarea itself. That's what keeps the textarea's own native
          scrollbar inset from the rounded corners and clear of the button —
          it draws flush against whatever box it belongs to, so giving it a
          smaller, borderless box (padded and gapped from the button by the
          shell) is what puts it "before the send button, with room top and
          bottom" instead of poking out past the rounded edge. It also drops
          the scrollable box's own border from its height math, which was
          the couple of stray pixels making the scrollbar appear even when
          the text still visually fit. */}
      <div className="flex items-start gap-2 rounded-3xl border border-border-subtle bg-bg-600 py-2 pl-6 pr-2 shadow-card transition-colors focus-within:border-accent/40 focus-within:shadow-glow">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your query to the AI assistant..."
          className="composer-input max-h-[200px] flex-1 resize-none overflow-y-auto bg-transparent py-2 text-[15px] text-text-100 placeholder:text-text-300"
        />

        {/* Telegram's send button: always present in the same slot, an arrow
            that never disappears. `items-start` on the shell keeps it pinned
            to the top as the textarea grows, rather than re-centring across
            a taller row. While a turn is running it swaps for a stop square
            instead of hiding, so there is always a control available rather
            than a live turn with nothing on screen to interrupt it. */}
        {isLoading ? (
          <motion.button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-accent text-primary-foreground hover:bg-accent-hover"
          >
            <Square className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
          </motion.button>
        ) : (
          <motion.button
            type="submit"
            disabled={!hasPrompt}
            aria-label="Send message"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-primary-foreground enabled:cursor-pointer enabled:hover:bg-accent-hover disabled:bg-bg-500 disabled:text-text-300"
          >
            <ArrowRight className="h-5 w-5" />
          </motion.button>
        )}
      </div>
    </form>
  );
}

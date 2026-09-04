'use client';

import { ArrowUp, LoaderCircle, Square } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, type KeyboardEvent, type SubmitEvent } from 'react';

import { ThinkingLevelSelect } from '@/components/thinking-level-select';
import type { ThinkingLevel } from '@/lib/agent-events';

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: SubmitEvent<HTMLFormElement>) => void;
  onStop: () => void;
  isLoading: boolean;
  isStopping: boolean;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (value: ThinkingLevel) => void;
};

// Grows with the content up to this height, then scrolls internally instead
// of pushing the rest of the page around — same cap most chat UIs use.
const MAX_HEIGHT_PX = 200;

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading,
  isStopping,
  thinkingLevel,
  onThinkingLevelChange,
}: ChatInputProps) {
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
      {/* Gemini's two-row composer: the text takes the full width of the
          shell, and the controls sit on their own row beneath it. That
          stacking is what fixes the alignment — the buttons keep a fixed
          relationship to the *bottom* of the box, so a one-line draft and a
          paragraph-long one put the send arrow in exactly the same place
          instead of stranding it beside the first line of a tall textarea.

          The border, background and shadow live on this shell rather than on
          the textarea itself. That's what keeps the textarea's own native
          scrollbar inset from the rounded corners — it draws flush against
          whatever box it belongs to, so giving it a smaller, borderless box
          keeps the bar clear of the rounded edge. It also drops the
          scrollable box's own border from its height math, which was the
          couple of stray pixels making the scrollbar appear even when the
          text still visually fit. */}
      <div className="rounded-3xl border border-border-subtle bg-bg-600 px-4 pb-2 pt-3 shadow-card transition-colors focus-within:border-accent/40 focus-within:shadow-glow">
        <textarea
          ref={textareaRef}
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your query to the AI assistant..."
          className="composer-input block max-h-[200px] w-full resize-none overflow-y-auto bg-transparent px-1 text-[15px] leading-6 text-text-100 placeholder:text-text-300"
        />

        {/* The toolbar. Right-aligned as a group, with the reasoning picker
            immediately left of the send button — `mt-2` is the only gap
            between it and the text, so the row stays visually part of the
            same box rather than reading as a separate bar. */}
        <div className="mt-2 flex items-center justify-end gap-1">
          <ThinkingLevelSelect
            value={thinkingLevel}
            onChange={onThinkingLevelChange}
            disabled={isLoading}
          />

          {/* Always present in the same slot, an arrow that never disappears.
              While a turn is running it swaps for a stop square instead of
              hiding, so there is always a control available rather than a
              live turn with nothing on screen to interrupt it. Stop's own
              click is a fire-and-forget POST with no visible effect until the
              turn actually ends, so `isStopping` gives it a spinner and locks
              the button — otherwise a click that clearly registered nowhere
              just looks like it didn't work. */}
          {isLoading ? (
            <motion.button
              type="button"
              onClick={onStop}
              disabled={isStopping}
              aria-label={isStopping ? 'Stopping…' : 'Stop generating'}
              title={isStopping ? 'Stopping…' : 'Stop generating'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary-foreground enabled:cursor-pointer enabled:hover:bg-accent-hover disabled:cursor-wait disabled:opacity-70"
            >
              {isStopping ? (
                <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={2.25} />
              ) : (
                <Square className="h-3 w-3" fill="currentColor" strokeWidth={0} />
              )}
            </motion.button>
          ) : (
            <motion.button
              type="submit"
              disabled={!hasPrompt}
              aria-label="Send message"
              title="Send message"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary-foreground enabled:cursor-pointer enabled:hover:bg-accent-hover disabled:bg-bg-500 disabled:text-text-300"
            >
              <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
            </motion.button>
          )}
        </div>
      </div>
    </form>
  );
}

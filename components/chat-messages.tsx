'use client';

import { ArrowDown, CircleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useState, useEffect } from 'react';
import { Streamdown } from 'streamdown';

import { AssistantAvatar } from '@/components/assistant-avatar';
import { CopyButton } from '@/components/copy-button';
import { FileEvent } from '@/components/file-event';
import { ReasoningEvent } from '@/components/reasoning-event';
import { StoppedEvent } from '@/components/stopped-event';
import { ToolEvent } from '@/components/tool-event';
import { Tooltip } from '@/components/tooltip';
import { TypingIndicator } from '@/components/typing-indicator';
import { UserAvatar } from '@/components/user-avatar';
import { formatElapsed } from '@/lib/format-elapsed';
import type { ChatEntry, ChatStatus } from '@/lib/use-agent-chat';

// How close to the bottom (in px) still counts as "there" — a few pixels of
// slack from momentum scrolling or a fractional scrollHeight shouldn't read
// as the user having deliberately scrolled away.
const BOTTOM_THRESHOLD_PX = 120;

type ChatMessagesProps = {
  entries: ChatEntry[];
  status: ChatStatus;
  isLoading: boolean;
  error?: Error;
  token: string;
  turnStartedAt: number | null;
};

/*
 * Bubble geometry. Both sides share a large radius; the one squared-off corner
 * is softened to 8px rather than 0 so the shape still points at its author
 * without breaking the rounded language the composer sets.
 *
 * The 85% cap deliberately lives on the flex row's direct child (the column
 * that also holds the copy button), not on the bubble itself: a percentage
 * width only resolves against a definite container, and the bubble's own
 * parent is an auto-sized flex item. Capping it there instead let the bubble
 * shrink to whatever its text actually needs, up to that limit — putting the
 * 85% back on the bubble reintroduces the bug where every reply wrapped at
 * its minimum content width no matter how short it was.
 */
const BUBBLE_BASE = 'rounded-3xl px-5 shadow-card text-[15px] leading-relaxed';

export function ChatMessages({
  entries,
  status,
  isLoading,
  error,
  token,
  turnStartedAt,
}: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Whether the viewport is sitting at (or near) the bottom right now. A ref
  // because the auto-scroll effect below needs its *current* value at the
  // moment new content lands, not the value from whatever render scheduled
  // that effect; mirrored into state purely so the "jump to latest" button
  // can react to it.
  const pinnedToBottomRef = useRef(true);
  const [isPinnedToBottom, setIsPinnedToBottom] = useState(true);
  const prevEntryCountRef = useRef(entries.length);

  const setPinned = (pinned: boolean) => {
    pinnedToBottomRef.current = pinned;
    setIsPinnedToBottom(pinned);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setPinned(distanceFromBottom < BOTTOM_THRESHOLD_PX);
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setPinned(true);
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    // Sending your own message always pulls the view back down, even after
    // scrolling up to reread something — you've just re-entered the
    // conversation. Anything else (a token, a tool call, someone else's
    // reply) only does that if the view was already pinned there; otherwise
    // it would yank a reader on message #3 back to message #50 the instant
    // a new one arrives, which is exactly the behaviour this replaces.
    const grew = entries.length > prevEntryCountRef.current;
    const last = entries[entries.length - 1];
    const sentOwnMessage = grew && last?.kind === 'message' && last.role === 'user';
    prevEntryCountRef.current = entries.length;

    if (sentOwnMessage) setPinned(true);

    if (pinnedToBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [entries, status]);

  // The typing dots stand in for an answer that hasn't started arriving. Once
  // the first token lands the bubble itself is the progress indicator, so
  // showing both would read as two pending replies.
  const last = entries[entries.length - 1];
  const isAnswering = last?.kind === 'message' && last.role === 'assistant';
  const showTyping = isLoading && !isAnswering;

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="h-full space-y-5 overflow-y-auto scroll-smooth p-4 no-scrollbar"
      >
        <AnimatePresence initial={false}>
          {entries.map((entry) => {
            if (entry.kind === 'reasoning') {
              return <ReasoningEvent key={entry.id} text={entry.text} />;
            }

            if (entry.kind === 'file') {
              return (
                <FileEvent key={entry.id} filename={entry.filename} url={entry.url} token={token} />
              );
            }

            if (entry.kind === 'stopped') {
              return <StoppedEvent key={entry.id} message={entry.message} />;
            }

            if (entry.kind === 'tool') {
              return (
                <ToolEvent
                  key={entry.id}
                  tool={entry.tool}
                  args={entry.args}
                  output={entry.output}
                  status={entry.status}
                  startedAt={entry.startedAt}
                  endedAt={entry.endedAt}
                />
              );
            }

            const isUser = entry.role === 'user';

            return (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3 }}
                className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                {!isUser && <AssistantAvatar />}

                {/* min-w-0 on both this and the bubble below is load-bearing:
                    a flex item's default min-width is its content's intrinsic
                    size, not 0, so a wide table (Streamdown already gives its
                    own table its own overflow-x-auto scrollbar) would still
                    force this whole chain wider instead of letting that
                    scrollbar do its job — the bubble would grow to fit the
                    table rather than the table scrolling inside the bubble. */}
                <div
                  className={`flex min-w-0 flex-col gap-1 ${isUser ? 'max-w-[60%] items-end' : 'max-w-full items-start'
                    }`}
                >
                  <div
                    className={`min-w-0 ${BUBBLE_BASE} ${isUser
                      ? 'rounded-br-lg bg-accent py-3 text-primary-foreground'
                      : 'rounded-bl-lg border border-border-subtle bg-bg-700 py-4 text-text-100'
                      }`}
                  >
                    {/* Only the model emits markdown; user text stays literal so
                        typing **foo** shows the asterisks rather than bolding. */}
                    {isUser ? (
                      <span className="whitespace-pre-wrap">{entry.text}</span>
                    ) : (
                      <Streamdown animated isAnimating={status === 'streaming'}>
                        {entry.text}
                      </Streamdown>
                    )}
                  </div>

                  {/* Copying only ever applies to what the model said. The
                      total duration only ever shows once the turn is fully
                      over (both timestamps set) — while it's still streaming
                      the live "Thinking for Xs" clock above already covers
                      that ground. */}
                  {!isUser && entry.text && (
                    <div className="flex items-center gap-2">
                      <CopyButton text={entry.text} />
                      {entry.startedAt !== undefined && entry.endedAt !== undefined && (
                        <span className="text-[11px] text-text-300">
                          {formatElapsed(entry.endedAt - entry.startedAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Sits after the bubble so it lands on the outer edge of the
                    right-aligned row; items-end keeps it on the bubble's baseline. */}
                {isUser && <UserAvatar />}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {showTyping && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-end justify-start gap-2.5"
          >
            <AssistantAvatar />
            <TypingIndicator startedAt={turnStartedAt} />
          </motion.div>
        )}

        {error && (
          <div className="flex items-end justify-start gap-2.5">
            <AssistantAvatar />
            <div className="flex max-w-[85%] items-start gap-2.5 rounded-3xl rounded-bl-lg border border-status-red/40 bg-red-bg px-5 py-4 text-sm text-status-red">
              <CircleAlert size={16} strokeWidth={2} className="mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap">{error.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Only ever appears once reading has scrolled the view away from the
          bottom — the ordinary case (already there, watching replies land)
          never sees it. Sits over the transcript rather than in flow, so it
          doesn't reflow content or move as new messages arrive underneath. */}
      {!isPinnedToBottom && (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
          <Tooltip content="Jump to latest message" className="pointer-events-auto">
            <button
              type="button"
              onClick={scrollToBottom}
              aria-label="Jump to latest message"
              className="flex size-9 cursor-pointer items-center justify-center rounded-full border border-border-subtle bg-bg-700 text-text-100 shadow-elevated transition-colors hover:bg-bg-600"
            >
              <ArrowDown size={16} strokeWidth={2} />
            </button>
          </Tooltip>
        </div>
      )}
    </div>
  );
}

'use client';

import { CircleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';

import { AssistantAvatar } from '@/components/assistant-avatar';
import { CopyButton } from '@/components/copy-button';
import { FileEvent } from '@/components/file-event';
import { ReasoningEvent } from '@/components/reasoning-event';
import { StoppedEvent } from '@/components/stopped-event';
import { ToolEvent } from '@/components/tool-event';
import { TypingIndicator } from '@/components/typing-indicator';
import { UserAvatar } from '@/components/user-avatar';
import type { ChatEntry, ChatStatus } from '@/lib/use-agent-chat';

type ChatMessagesProps = {
  entries: ChatEntry[];
  status: ChatStatus;
  isLoading: boolean;
  error?: Error;
  token: string;
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

export function ChatMessages({ entries, status, isLoading, error, token }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, status]);

  // The typing dots stand in for an answer that hasn't started arriving. Once
  // the first token lands the bubble itself is the progress indicator, so
  // showing both would read as two pending replies.
  const last = entries[entries.length - 1];
  const isAnswering = last?.kind === 'message' && last.role === 'assistant';
  const showTyping = isLoading && !isAnswering;

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 space-y-5 overflow-y-auto scroll-smooth p-4 no-scrollbar"
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

              <div className={`flex max-w-[60%] flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
                <div
                  className={`${BUBBLE_BASE} ${isUser
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

                {/* Copying only ever applies to what the model said. */}
                {!isUser && entry.text && <CopyButton text={entry.text} />}
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
          <TypingIndicator />
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
  );
}

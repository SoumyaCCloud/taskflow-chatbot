'use client';

import { CircleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';

import { AssistantAvatar } from '@/components/assistant-avatar';
import { ReasoningEvent } from '@/components/reasoning-event';
import { ToolEvent } from '@/components/tool-event';
import { TypingIndicator } from '@/components/typing-indicator';
import { UserAvatar } from '@/components/user-avatar';
import type { ChatEntry, ChatStatus } from '@/lib/use-agent-chat';

type ChatMessagesProps = {
  entries: ChatEntry[];
  status: ChatStatus;
  isLoading: boolean;
  error?: Error;
};

/*
 * Bubble geometry. Both sides share a large radius; the one squared-off corner
 * is softened to 8px rather than 0 so the shape still points at its author
 * without breaking the rounded language the composer sets.
 */
const BUBBLE_BASE =
  'max-w-[85%] rounded-3xl px-5 shadow-card text-[15px] leading-relaxed';

export function ChatMessages({ entries, status, isLoading, error }: ChatMessagesProps) {
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

          if (entry.kind === 'tool') {
            return (
              <ToolEvent
                key={entry.id}
                tool={entry.tool}
                args={entry.args}
                output={entry.output}
                status={entry.status}
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

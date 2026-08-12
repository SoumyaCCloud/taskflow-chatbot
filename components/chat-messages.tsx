'use client';

import type { ChatStatus, UIMessage } from 'ai';
import { CircleAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';

import { AssistantAvatar } from '@/components/assistant-avatar';
import { TypingIndicator } from '@/components/typing-indicator';
import { UserAvatar } from '@/components/user-avatar';

type ChatMessagesProps = {
  messages: UIMessage[];
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

export function ChatMessages({ messages, status, isLoading, error }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, status]);

  return (
    <div
      ref={scrollRef}
      className="min-h-0 flex-1 space-y-5 overflow-y-auto scroll-smooth p-4 no-scrollbar"
    >
      <AnimatePresence initial={false}>
        {messages.map((m: UIMessage) => {
          const isUser = m.role === 'user';

          return (
            <motion.div
              key={m.id}
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
                {m.parts.map((part, i) => {
                  if (part.type !== 'text') return null;
                  // Only the model emits markdown; user text stays literal so
                  // typing **foo** shows the asterisks rather than bolding.
                  return m.role === 'assistant' ? (
                    <Streamdown key={i} animated isAnimating={status === 'streaming'}>
                      {part.text}
                    </Streamdown>
                  ) : (
                    <span key={i} className="whitespace-pre-wrap">
                      {part.text}
                    </span>
                  );
                })}
              </div>

              {/* Sits after the bubble so it lands on the outer edge of the
                  right-aligned row; items-end keeps it on the bubble's baseline. */}
              {isUser && <UserAvatar />}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {isLoading && (
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

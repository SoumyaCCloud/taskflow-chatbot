'use client';

import type { ChatStatus, UIMessage } from 'ai';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useEffect } from 'react';
import { Streamdown } from 'streamdown';

type ChatMessagesProps = {
  messages: UIMessage[];
  status: ChatStatus;
  isLoading: boolean;
  error?: Error;
};

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
      className="min-h-0 flex-1 space-y-4 overflow-y-auto scroll-smooth p-4 no-scrollbar"
    >
      <AnimatePresence initial={false}>
        {messages.map((m: UIMessage) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] rounded-card p-4 shadow-card ${m.role === 'user'
                ? 'bg-accent text-white rounded-br-none'
                : 'bg-bg-700 text-text-100 rounded-bl-none border border-border-subtle'
              }`}>
              {m.parts.map((part, i) => {
                if (part.type !== 'text') return null;
                // Only the model emits markdown; user text stays literal so
                // typing **foo** shows the asterisks rather than bolding.
                return m.role === 'assistant' ? (
                  <Streamdown key={i} animated isAnimating={status === 'streaming'}>
                    {part.text}
                  </Streamdown>
                ) : (
                  <span key={i}>{part.text}</span>
                );
              })}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {isLoading && (
        <div className="flex justify-start">
          <div className="animate-pulse rounded-card border border-border-subtle bg-bg-700 p-4 text-text-300">
            I&apos;m thinking🤔🤔🤔
          </div>
        </div>
      )}

      {error && (
        <div className="flex justify-start">
          <div className="max-w-[85%] whitespace-pre-wrap rounded-card border border-status-red/40 bg-red-bg p-4 text-sm text-status-red">
            {error.message}
          </div>
        </div>
      )}
    </div>
  );
}

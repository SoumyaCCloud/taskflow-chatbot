'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import 'streamdown/styles.css';

import { ChatInput } from '@/components/chat-input';
import { ChatMessages } from '@/components/chat-messages';
import { EmptyState } from '@/components/empty-state';
import { useSessionToken } from '@/components/shell-session-provider';
import { SuggestedPrompts } from '@/components/suggested-prompts';
import { useAgentChat } from '@/lib/use-agent-chat';

export default function Page() {
  // The bearer the shell handed the iframe; every turn is authorized with it.
  const token = useSessionToken();
  const { entries, status, error, sendMessage } = useAgentChat(token);
  const [input, setInput] = useState('');

  const isLoading = status === 'submitted' || status === 'streaming';
  // Empty chat centers the composer; the first message drops it to the bottom.
  const hasConversation = entries.length > 0;
  const isEmptyState = !hasConversation && !error;
  // Starters are a substitute for knowing what to ask; the moment you start
  // typing you already know, so they get out of the way.
  const showSuggestions = isEmptyState && input.trim().length === 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    void sendMessage(input);
    setInput('');
  };

  // A starter chip sends immediately rather than pre-filling the composer —
  // the chip already reads as the finished question.
  const handlePick = (prompt: string) => {
    if (isLoading) return;
    void sendMessage(prompt);
    setInput('');
  };

  return (
    <main className={`mx-auto flex h-full w-full max-w-3xl flex-col p-4 ${hasConversation ? '' : 'justify-center'}`}
    >
      {(hasConversation || error) && (
        <ChatMessages
          entries={entries}
          status={status}
          isLoading={isLoading}
          error={error}
        />
      )}

      {/* The greeting only exists in the empty state — once the conversation
          starts the transcript deserves the vertical space. */}
      {isEmptyState && <EmptyState />}

      {/* Kept in the same tree position in both states so `layout` tweens the
          composer from center to bottom instead of remounting it. */}
      <motion.div
        layout
        transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
        className={hasConversation ? 'mt-4' : ''}
      >
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          disabled={isLoading}
        />

        {/* Under the composer, inside the same layout-animated block so the
            chips travel with it rather than jumping when it recentres. */}
        <AnimatePresence initial={false}>
          {showSuggestions && (
            <SuggestedPrompts onPick={handlePick} disabled={isLoading} />
          )}
        </AnimatePresence>
      </motion.div>
    </main>
  );
}

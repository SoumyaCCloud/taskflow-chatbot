'use client';

import { useChat } from '@ai-sdk/react';
import { motion } from 'motion/react';
import { useState, type FormEvent } from 'react';
import 'streamdown/styles.css';

import { ChatInput } from '@/components/chat-input';
import { ChatMessages } from '@/components/chat-messages';

export default function Page() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState('');

  const isLoading = status === 'submitted' || status === 'streaming';
  // Empty chat centers the composer; the first message drops it to the bottom.
  const hasConversation = messages.length > 0;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };

  return (
    <main
      className={`mx-auto flex h-full w-full max-w-3xl flex-col p-4 ${hasConversation ? '' : 'justify-center'
        }`}
    >
      {(hasConversation || error) && (
        <ChatMessages
          messages={messages}
          status={status}
          isLoading={isLoading}
          error={error}
        />
      )}

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
      </motion.div>
    </main>
  );
}

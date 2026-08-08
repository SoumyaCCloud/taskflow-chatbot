'use client';

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { motion, AnimatePresence } from 'motion/react';
import { useRef, useEffect, useState } from 'react';
import { Streamdown } from 'streamdown';
import 'streamdown/styles.css';

export default function Page() {
  const { messages, sendMessage, status, error } = useChat({
    messages: [
      {
        id: '1',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: 'Hello! I am your AI assistant. How can I help you with your project today?',
          },
        ],
      },
    ],
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 p-4 scroll-smooth">
        <AnimatePresence initial={false}>
          {messages.map((m: UIMessage) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${m.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'markdown-surface bg-zinc-100 text-zinc-900 rounded-bl-none border border-zinc-200'
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
            <div className="bg-zinc-100 p-4 rounded-2xl animate-pulse text-zinc-400">
              I'm thinking🤔🤔🤔
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[85%] p-4 rounded-2xl bg-red-50 text-red-800 border border-red-200 text-sm whitespace-pre-wrap">
              {error.message}
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          sendMessage({ text: input });
          setInput('');
        }}
        className="mt-4 relative"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your project..."
          className="w-full p-4 pr-12 rounded-xl border border-zinc-300 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-lg"
        />
        <button
          type="submit"
          disabled={!input || isLoading}
          className="absolute right-2 top-2 bottom-2 px-4 bg-blue-600 text-white rounded-lg disabled:bg-zinc-300 transition-colors"
        >
          Send
        </button>
      </form>
    </main>
  );
}

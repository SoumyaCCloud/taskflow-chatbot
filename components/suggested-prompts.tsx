'use client';

import { FolderPlus, ListChecks, UserCog, Users } from 'lucide-react';
import { motion } from 'motion/react';
import type { ComponentType } from 'react';

/*
 * Starters shown under the composer on an empty chat. These reference project
 * data the assistant cannot reach yet — app/api/chat/route.ts is a plain model
 * call with no tools — so they will not return real results until it is wired
 * up.
 */
const SUGGESTIONS: { text: string; icon: ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { text: "List out all the teams I'm assigned to", icon: Users },
  { text: "List all the tasks I've been assigned", icon: ListChecks },
  { text: 'How do I create a new workspace and add a team to it?', icon: FolderPlus },
  { text: 'What roles are available when assigning someone to a team?', icon: UserCog },
];

type SuggestedPromptsProps = {
  onPick: (prompt: string) => void;
  disabled: boolean;
};

export function SuggestedPrompts({ onPick, disabled }: SuggestedPromptsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="mt-4 flex flex-wrap justify-center gap-2"
    >
      {SUGGESTIONS.map(({ text, icon: Icon }, i) => (
        <motion.button
          key={text}
          type="button"
          disabled={disabled}
          onClick={() => onPick(text)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.07, ease: [0.4, 0, 0.2, 1] }}
          className="flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-700 px-3.5 py-1.5 text-xs text-text-200 shadow-card hover:border-accent/40 hover:bg-bg-600 hover:text-text-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon size={13} strokeWidth={2} />
          {text}
        </motion.button>
      ))}
    </motion.div>
  );
}

'use client';

import { CornerDownLeft, Wrench } from 'lucide-react';
import { motion } from 'motion/react';

/*
 * Tool activity is machinery, not conversation — it reads as a quiet inline
 * note on the assistant's side of the transcript rather than a bubble, so a
 * turn that calls three tools before answering doesn't shout over the answer.
 */
export function ToolEvent({
  tool,
  args,
  output,
}: {
  tool: string;
  args?: unknown;
  output?: string;
}) {
  const isResult = output !== undefined;

  // Long JSON would push the transcript sideways; the full text stays in the
  // title attribute for anyone who needs it.
  const detail = isResult ? output : args === undefined ? '' : JSON.stringify(args);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start pl-10"
    >
      <div
        title={detail}
        className="flex max-w-[85%] items-center gap-2 rounded-full border border-border-subtle bg-bg-800 px-3 py-1.5 text-xs text-text-200"
      >
        {isResult ? (
          <CornerDownLeft size={13} strokeWidth={2} className="shrink-0 text-status-green" />
        ) : (
          <Wrench size={13} strokeWidth={2} className="shrink-0 text-accent" />
        )}
        <span className="font-medium text-text-100">{tool}</span>
        {detail && <span className="truncate font-mono text-[11px]">{detail}</span>}
      </div>
    </motion.div>
  );
}

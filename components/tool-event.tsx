'use client';

import { ChevronRight, CircleCheck, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

/*
 * Tool activity is machinery, not conversation — it reads as a quiet inline
 * chip on the assistant's side of the transcript, "Calling X…" while it runs
 * and "Called X" once it resolves, the same shape Claude uses for its own
 * tool calls. Args/output are collapsed by default and expand on click so a
 * turn that calls three tools doesn't shout over the answer.
 */
export function ToolEvent({
  tool,
  args,
  output,
  status,
}: {
  tool: string;
  args?: unknown;
  output?: string;
  status: 'running' | 'done';
}) {
  const [open, setOpen] = useState(false);

  const argsText = args === undefined ? undefined : typeof args === 'string' ? args : JSON.stringify(args);
  const hasDetail = argsText !== undefined || output !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start pl-10"
    >
      <div className="flex max-w-[85%] flex-col items-start gap-1.5">
        <button
          type="button"
          onClick={() => hasDetail && setOpen((o) => !o)}
          disabled={!hasDetail}
          aria-expanded={open}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-800 px-3 py-1.5 text-xs text-text-200 transition-colors enabled:hover:bg-bg-700 enabled:cursor-pointer"
        >
          {status === 'running' ? (
            <LoaderCircle size={13} strokeWidth={2} className="shrink-0 animate-spin text-accent" />
          ) : (
            <CircleCheck size={13} strokeWidth={2} className="shrink-0 text-status-green" />
          )}
          <span>
            {status === 'running' ? 'Calling ' : 'Called '}
            <span className="font-medium text-text-100">{tool}</span>
          </span>
          {hasDetail && (
            <ChevronRight
              size={12}
              strokeWidth={2}
              className={`shrink-0 text-text-300 transition-transform ${open ? 'rotate-90' : ''}`}
            />
          )}
        </button>

        {open && hasDetail && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.15 }}
            className="w-full space-y-1.5 overflow-hidden rounded-xl border border-border-subtle bg-bg-800 px-3 py-2 font-mono text-[11px] text-text-200"
          >
            {argsText && (
              <div>
                <span className="text-text-300">input </span>
                <span className="whitespace-pre-wrap break-words">{argsText}</span>
              </div>
            )}
            {output !== undefined && (
              <div>
                <span className="text-text-300">output </span>
                <span className="whitespace-pre-wrap break-words">{output}</span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

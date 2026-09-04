'use client';

import { ArrowRightLeft, ChevronRight, CircleCheck, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';

const HANDOFF_PREFIX = 'handoff_to_';

/** "handoff_to_billing_team" -> "Billing team" — a domain name worth reading, not a tool id. */
function formatHandoffDomain(tool: string): string {
  const domain = tool.slice(HANDOFF_PREFIX.length).replace(/_/g, ' ');
  return domain.charAt(0).toUpperCase() + domain.slice(1);
}

/** "1s" while under a minute, "1m 04s" past it — Claude's own tool-call clock does the same. */
function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

/** Ticks once a second while `endedAt` is unset, then freezes on the final duration. */
function useElapsed(startedAt: number, endedAt: number | undefined): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endedAt !== undefined) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endedAt]);

  return formatElapsed((endedAt ?? now) - startedAt);
}

/*
 * Tool activity is machinery, not conversation — it reads as a quiet inline
 * chip on the assistant's side of the transcript, "Calling X…" while it runs
 * and "Called X" once it resolves, the same shape Claude uses for its own
 * tool calls — including the small running clock beside the name. Args/output
 * are collapsed by default and expand on click so a turn that calls three
 * tools doesn't shout over the answer.
 *
 * A `handoff_to_*` call is a specialist routing the turn to another domain,
 * not a real backend action, so it reads as "Handing off to X: reason"
 * instead — see lib/use-agent-chat.ts for why its tool_result never adds an
 * output line here (it's just an echo of that same reason).
 */
export function ToolEvent({
  tool,
  args,
  output,
  status,
  startedAt,
  endedAt,
}: {
  tool: string;
  args?: unknown;
  output?: string;
  status: 'running' | 'done';
  startedAt: number;
  endedAt?: number;
}) {
  const [open, setOpen] = useState(false);
  const elapsed = useElapsed(startedAt, endedAt);

  // A specialist explicitly routing the rest of the turn to another domain
  // (agent/handoff_tools.py), not a real backend action — reads as "Handing
  // off to X: reason" rather than a generic tool call.
  const isHandoff = tool.startsWith(HANDOFF_PREFIX);
  const handoffReason =
    isHandoff && args && typeof args === 'object' && 'reason' in args
      ? String((args as { reason?: unknown }).reason ?? '')
      : undefined;

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
          title={hasDetail ? (open ? 'Hide details' : 'Show details') : undefined}
          className="flex items-center gap-2 rounded-full border border-border-subtle bg-bg-800 px-3 py-1.5 text-xs text-text-200 transition-colors enabled:hover:bg-bg-700 enabled:cursor-pointer"
        >
          {status === 'running' ? (
            <LoaderCircle size={13} strokeWidth={2} className="shrink-0 animate-spin text-accent" />
          ) : isHandoff ? (
            <ArrowRightLeft size={13} strokeWidth={2} className="shrink-0 text-status-green" />
          ) : (
            <CircleCheck size={13} strokeWidth={2} className="shrink-0 text-status-green" />
          )}
          <span>
            {isHandoff ? (
              <>
                {status === 'running' ? 'Handing off to ' : 'Handed off to '}
                <span className="font-medium text-text-100">{formatHandoffDomain(tool)}</span>
              </>
            ) : (
              <>
                {status === 'running' ? 'Calling ' : 'Called '}
                <span className="font-medium text-text-100">{tool}</span>
              </>
            )}
          </span>
          {handoffReason && <span className="max-w-[200px] truncate text-text-300">· {handoffReason}</span>}
          <span className="text-text-300">{elapsed}</span>
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

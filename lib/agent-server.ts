import type { ModelMessage } from 'ai';

import type { AgentEvent } from '@/lib/agent-events';
import { readSessionToken } from '@/lib/shell-session';

/**
 * The bearer to call the agent with, in order of authority:
 *
 *   1. what the chat sent — the token the shell handed the iframe;
 *   2. the taskflow_session cookie — the same-origin case, where the browser
 *      still has the session even though the iframe URL carried nothing;
 *   3. TASKFLOW_DEV_TOKEN — opening the app directly at localhost, which has
 *      neither. Development only, so a missing session in production is still
 *      a 401 rather than a silent fall back to a shared token.
 */
export function resolveBearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  if (/^Bearer\s+\S/i.test(header)) return header;

  const cookie = readSessionToken(
    /(?:^|;\s*)taskflow_session=([^;]+)/.exec(req.headers.get('cookie') ?? '')?.[1],
  );
  if (cookie) return `Bearer ${cookie}`;

  if (process.env.NODE_ENV === 'development') {
    // The agent rejects a request with no Authorization header at all, so the
    // placeholder is what makes the chat usable at localhost with no session:
    // it converses normally and its TaskFlow tool calls come back 401 until a
    // real token is set here or arrives on the URL.
    return `Bearer ${readSessionToken(process.env.TASKFLOW_DEV_TOKEN) || 'no-session'}`;
  }

  return null;
}

export type LocalJob = {
  status: 'running' | 'completed' | 'error';
  events: AgentEvent[];
};

/*
 * The local (no TASKFLOW_AGENT_URL) fallback's job board. It has to be a
 * module singleton rather than living inside route.ts, because the POST route
 * that creates a job and the GET route that polls it are separate files —
 * this is what lets both see the same Map within one Node process. It does
 * not survive a restart and does not span multiple instances, same trade the
 * conversation-history store below already makes; acceptable because this
 * path only runs in local development, never once TASKFLOW_AGENT_URL is set.
 */
const jobs = new Map<string, LocalJob>();
const MAX_JOBS = 200;

export function createLocalJob(id: string): LocalJob {
  // Oldest-first eviction so a long-lived dev server can't grow without bound.
  if (jobs.size >= MAX_JOBS) {
    const oldest = jobs.keys().next().value;
    if (oldest !== undefined) jobs.delete(oldest);
  }
  const job: LocalJob = { status: 'running', events: [] };
  jobs.set(id, job);
  return job;
}

export function getLocalJob(id: string): LocalJob | undefined {
  return jobs.get(id);
}

/**
 * Local-mode conversation memory. The protocol sends only the newest message
 * plus a `thread_id`, so history has to live on this side. Process-local and
 * lost on restart, which is the right trade for a dev fallback — the real
 * agent service owns durable history.
 */
const threads = new Map<string, ModelMessage[]>();
const MAX_THREADS = 100;
export const MAX_HISTORY = 40;

export function historyFor(threadId: string): ModelMessage[] {
  const existing = threads.get(threadId);
  if (existing) return existing;

  if (threads.size >= MAX_THREADS) {
    const oldest = threads.keys().next().value;
    if (oldest !== undefined) threads.delete(oldest);
  }

  const fresh: ModelMessage[] = [];
  threads.set(threadId, fresh);
  return fresh;
}

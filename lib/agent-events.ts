/*
 * The wire protocol the TaskFlow agent speaks. There is no long-lived
 * connection anywhere in this chain: the real agent sits behind a proxy that
 * kills any single connection left quiet for ~100s, which a slow
 * multi-tool-call turn can easily exceed. So a turn is a small job, fired and
 * then polled:
 *
 *   POST /api/agent            {"message": "...", "thread_id": "..."}
 *     -> {"job_id": "..."}
 *   GET  /api/agent/{job_id}
 *     -> {"status": "running", "events": [...]}      (poll again)
 *     -> {"status": "completed", "events": [...]}     (stop polling)
 *   POST /api/agent/{job_id}/stop
 *     -> {"ok": true}   (the running job's next poll carries a `stopped` event)
 *
 * A `file` event's `url` lives on the agent's own host, possibly (the
 * reference test harness doesn't bother) gated by the same bearer as chat —
 * the browser can't fetch it directly either way (a token would have to
 * leave our origin, and a plain `<a>` can't attach one as a header anyway),
 * so `GET /api/agent/download` proxies it instead. See that route for why
 * the target is restricted to the agent's origin, and why the bearer it
 * forwards is optional rather than required.
 *
 * Both ends of the app share these types — `app/api/agent/**\/route.ts` writes
 * them, `lib/use-agent-chat.ts` reads them — so a change to the shape breaks
 * compilation rather than the chat at runtime.
 */
export type AgentEvent =
  | { type: 'token'; content: string }
  | { type: 'reasoning'; content: string }
  | { type: 'tool_call'; tool: string; args: unknown }
  | { type: 'tool_result'; tool: string; output: string }
  | { type: 'file'; filename: string; url: string }
  | { type: 'stopped'; message: string }
  | { type: 'error'; message: string };

/**
 * How much reasoning the agent should spend on a turn. Picked per-message from
 * the composer's dropdown, so it travels with the request rather than being a
 * property of the thread.
 */
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/** Every level, in ascending order — the composer renders the dropdown from this. */
export const THINKING_LEVELS = ['minimal', 'low', 'medium', 'high'] as const satisfies readonly ThinkingLevel[];

/** The level a fresh composer starts on. */
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'low';

/** Narrows an unvalidated value (a request body, say) to a level. */
export function isThinkingLevel(value: unknown): value is ThinkingLevel {
  return THINKING_LEVELS.includes(value as ThinkingLevel);
}

/** What the client POSTs. History lives server-side, keyed by `thread_id`. */
export type AgentRequest = {
  message: string;
  thread_id: string;
  thinking_level: ThinkingLevel;
};

/** What starting a turn returns: the job id to poll for progress. */
export type AgentStartResponse = {
  job_id: string;
};

/** What each poll of a job returns. `status` stays `"running"` until the turn is over. */
export type AgentJobResponse = {
  status: 'running' | 'completed' | 'error' | (string & {});
  events: AgentEvent[];
};

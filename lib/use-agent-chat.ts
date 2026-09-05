'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  DEFAULT_THINKING_LEVEL,
  type AgentEvent,
  type AgentJobResponse,
  type AgentRequest,
  type AgentStartResponse,
  type ModelSelection,
  type ThinkingLevel,
} from '@/lib/agent-events';

/**
 * Everything about a turn beyond its text — all optional, all defaulted to
 * "leave it as configured" (no thinking-level or model override at all)
 * except the level, which defaults to the composer's own opening value.
 */
export type SendMessageOptions = {
  thinkingLevel?: ThinkingLevel;
  modelSelection?: ModelSelection | null;
  summarizerModelSelection?: ModelSelection | null;
};

/*
 * The chat transcript. Tool activity is a sibling of the messages rather than
 * a field on one: a turn can call several tools before it says anything, and
 * they should appear as they happen instead of retroactively inside a bubble
 * that does not exist yet.
 */
export type ChatEntry =
  | {
    id: string;
    kind: 'message';
    role: 'user' | 'assistant';
    text: string;
    // Wall-clock timestamps for the turn that produced this message — unset
    // on the user's own messages, and on an assistant one until its first
    // token lands. Lets ChatMessages show a live "Thinking for Xs" before
    // that, and a frozen total turn time next to the copy button after.
    startedAt?: number;
    endedAt?: number;
  }
  | {
    id: string;
    kind: 'tool';
    tool: string;
    args?: unknown;
    output?: string;
    status: 'running' | 'done';
    // Client-side wall-clock timestamps (ms) — the protocol carries no timing
    // of its own — so ToolEvent can show a Claude-style elapsed counter next
    // to the call: ticking while `endedAt` is unset, frozen once it lands.
    startedAt: number;
    endedAt?: number;
  }
  | { id: string; kind: 'reasoning'; text: string }
  | { id: string; kind: 'file'; filename: string; url: string }
  | { id: string; kind: 'stopped'; message: string }
  | { id: string; kind: 'error'; message: string };

export type ChatStatus = 'ready' | 'submitted' | 'streaming';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `e${counter}`;
}

/** The monotonic counter behind an id (`"e42"` -> `42`) — lets two ids be compared for issue order. */
function idSequence(id: string): number {
  return Number(id.slice(1));
}

// How often a running job is polled for new events. The real agent has no
// live connection to push over — see lib/agent-events.ts — so this is the
// only way progress arrives.
const POLL_INTERVAL_MS = 2000;

/** Like `setTimeout`, but resolves early if `signal` aborts instead of firing a dead poll. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

/**
 * Speaks the agent's job/poll protocol from the browser: POST starts a turn
 * and returns a job id almost instantly, then GET is polled until the job
 * stops running. See lib/agent-events.ts for why there is no streamed
 * connection here.
 */
export function useAgentChat(token: string) {
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [status, setStatus] = useState<ChatStatus>('ready');
  // True from the moment Stop is clicked until the turn actually ends —
  // the click itself is silent (a fire-and-forget POST), so without this the
  // button gives no sign the press registered until the `stopped` event
  // eventually arrives on the next poll.
  const [isStopping, setIsStopping] = useState(false);
  // Set the instant a turn is sent, cleared once it ends — lets the "typing"
  // indicator show a live "Thinking for Xs" before there's an assistant
  // message entry yet for it to live on.
  const [turnStartedAt, setTurnStartedAt] = useState<number | null>(null);

  // One id for the life of the mounted chat: the server keys history off it, so
  // a new one mid-conversation would silently start the agent over. Lazy
  // initialiser rather than a ref — it must survive re-render, and it is never
  // written again after mount.
  const [threadId] = useState(() => crypto.randomUUID());

  const abortRef = useRef<AbortController | null>(null);

  // The job currently being polled, if the initial POST has resolved.
  // `stop()` needs this to tell the backend which run to actually
  // terminate — aborting the client's own fetches wouldn't touch the
  // generation still running server-side.
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => {
    // A poll loop left running after unmount keeps writing into dead state.
    return () => abortRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    const jobId = jobIdRef.current;

    if (!jobId) {
      // No job yet — still waiting on the initial POST, so the only thing to
      // interrupt is that request itself.
      abortRef.current?.abort();
      return;
    }

    setIsStopping(true);

    // The poll loop is left running on purpose: it's what picks up the
    // `stopped` event (and the status leaving "running") once the backend
    // actually tears the job down, the same way it picks up any other event.
    void fetch(`/api/agent/${jobId}/stop`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch((err) => {
      console.error('Failed to request stop:', err);
    });
  }, [token]);

  const sendMessage = useCallback(
    // These are per-turn rather than per-thread — whatever the composer's
    // controls read at the moment Send was pressed, so changing one
    // afterwards never rewrites a turn already in flight.
    async (text: string, options: SendMessageOptions = {}) => {
      const {
        thinkingLevel = DEFAULT_THINKING_LEVEL,
        modelSelection = null,
        summarizerModelSelection = null,
      } = options;

      const message = text.trim();
      if (!message || status !== 'ready') return;

      // Captured once per turn rather than read fresh each time it's needed:
      // the assistant entry created below and the "ended" stamp in `finally`
      // both have to agree on the same instant the turn actually began.
      const turnStartedAt = Date.now();

      setStatus('submitted');
      setTurnStartedAt(turnStartedAt);
      setEntries((prev) => [
        ...prev,
        { id: nextId(), kind: 'message', role: 'user', text: message },
      ]);

      const controller = new AbortController();
      abortRef.current = controller;

      // The answer streams in as a run of `token` events — they accumulate
      // into one growing bubble, created lazily so a tool-only turn doesn't
      // leave an empty one.
      let answerId: string | null = null;

      // The protocol pairs a `tool_call` with a later `tool_result` by tool
      // name only (no call id), so a FIFO queue per tool name is how the
      // result finds its way back to the chip that started running — turning
      // two events into one entry that flips from "Calling" to "Called"
      // instead of leaving two separate log lines.
      const pendingToolCalls = new Map<string, string[]>();

      const applyEvent = (event: AgentEvent) => {
        switch (event.type) {
          case 'token': {
            if (answerId === null) {
              const id = nextId();
              answerId = id;
              setEntries((prev) => [
                ...prev,
                { id, kind: 'message', role: 'assistant', text: '', startedAt: turnStartedAt },
              ]);
            }
            const id = answerId;
            setEntries((prev) =>
              prev.map((entry) =>
                entry.id === id && entry.kind === 'message'
                  ? { ...entry, text: entry.text + event.content }
                  : entry,
              ),
            );
            break;
          }
          case 'reasoning':
            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'reasoning', text: event.content },
            ]);
            break;
          case 'tool_call': {
            const id = nextId();
            const queue = pendingToolCalls.get(event.tool) ?? [];
            queue.push(id);
            pendingToolCalls.set(event.tool, queue);
            setEntries((prev) => [
              ...prev,
              {
                id,
                kind: 'tool',
                tool: event.tool,
                args: event.args,
                status: 'running',
                startedAt: Date.now(),
              },
            ]);
            break;
          }
          case 'tool_result': {
            const queue = pendingToolCalls.get(event.tool);
            const id = queue?.shift();
            // A handoff's result is just an echo of the reason its call
            // already showed — nothing new to display, so the chip just
            // needs to stop spinning, not gain an output line.
            const isHandoff = event.tool.startsWith('handoff_to_');

            if (id) {
              const endedAt = Date.now();
              setEntries((prev) =>
                prev.map((entry) =>
                  entry.id === id && entry.kind === 'tool'
                    ? { ...entry, status: 'done', endedAt, ...(isHandoff ? {} : { output: event.output }) }
                    : entry,
                ),
              );
            } else if (!isHandoff) {
              // A result with no matching call (e.g. reconnect mid-turn)
              // still deserves a line rather than being dropped silently —
              // there's no real start time to show, so it reads as instant.
              const now = Date.now();
              setEntries((prev) => [
                ...prev,
                {
                  id: nextId(),
                  kind: 'tool',
                  tool: event.tool,
                  output: event.output,
                  status: 'done',
                  startedAt: now,
                  endedAt: now,
                },
              ]);
            }
            break;
          }
          case 'file': {
            // Some tools (export_document, at least) never send a matching
            // tool_result — the file itself is the result, so nothing else
            // would ever flip that chip out of "running" otherwise, and it
            // would spin forever. The oldest still-pending call (ids are
            // issued in order, so the lowest sequence number is the oldest)
            // resolves here instead.
            let oldestTool: string | null = null;
            let oldestId: string | null = null;
            for (const [tool, queue] of pendingToolCalls) {
              const id = queue[0];
              if (id !== undefined && (oldestId === null || idSequence(id) < idSequence(oldestId))) {
                oldestTool = tool;
                oldestId = id;
              }
            }

            if (oldestTool !== null && oldestId !== null) {
              pendingToolCalls.get(oldestTool)?.shift();
              const endedAt = Date.now();
              const resolvedId = oldestId;
              setEntries((prev) =>
                prev.map((entry) =>
                  entry.id === resolvedId && entry.kind === 'tool'
                    ? { ...entry, status: 'done', endedAt }
                    : entry,
                ),
              );
            }

            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'file', filename: event.filename, url: event.url },
            ]);
            break;
          }
          case 'stopped':
            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'stopped', message: event.message },
            ]);
            break;
          case 'error':
            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'error', message: event.message },
            ]);
            break;
        }
      };

      try {
        const startResponse = await fetch('/api/agent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Only sent when the shell actually gave us one. Without it the
            // route falls back to the session cookie, so an empty header here
            // would override a session the server can see and we cannot.
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message,
            thread_id: threadId,
            thinking_level: thinkingLevel,
            ...(modelSelection
              ? { model_provider: modelSelection.provider, model_name: modelSelection.model }
              : {}),
            ...(summarizerModelSelection
              ? {
                summarizer_model_provider: summarizerModelSelection.provider,
                summarizer_model_name: summarizerModelSelection.model,
              }
              : {}),
          } satisfies AgentRequest),
          signal: controller.signal,
        });

        if (!startResponse.ok) {
          const detail = await startResponse.text().catch(() => '');
          throw new Error(detail || `Request failed (HTTP ${startResponse.status}).`);
        }

        const { job_id: jobId } = (await startResponse.json()) as AgentStartResponse;
        jobIdRef.current = jobId;
        setStatus('streaming');

        let renderedCount = 0;
        while (!controller.signal.aborted) {
          const pollResponse = await fetch(`/api/agent/${jobId}`, {
            signal: controller.signal,
          });

          if (!pollResponse.ok) {
            const detail = await pollResponse.text().catch(() => '');
            throw new Error(detail || `Polling failed (HTTP ${pollResponse.status}).`);
          }

          const { status: jobStatus, events } = (await pollResponse.json()) as AgentJobResponse;

          for (; renderedCount < events.length; renderedCount++) {
            applyEvent(events[renderedCount]);
          }

          if (jobStatus !== 'running') break;
          await wait(POLL_INTERVAL_MS, controller.signal);
        }
      } catch (err) {
        // Aborting is our own doing (unmount), not something to report.
        if (!controller.signal.aborted) {
          const message = err instanceof Error ? err.message : String(err);
          setEntries((prev) => [...prev, { id: nextId(), kind: 'error', message }]);
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        jobIdRef.current = null;

        // Only an entry that actually exists gets a final time — a turn that
        // never produced any text (an error, or stopped before the first
        // token) has nothing for a duration to attach to.
        if (answerId !== null) {
          const endedAt = Date.now();
          const finishedAnswerId = answerId;
          setEntries((prev) =>
            prev.map((entry) =>
              entry.id === finishedAnswerId && entry.kind === 'message'
                ? { ...entry, endedAt }
                : entry,
            ),
          );
        }

        setTurnStartedAt(null);
        setStatus('ready');
        setIsStopping(false);
      }
    },
    [status, token, threadId],
  );

  return { entries, status, sendMessage, stop, isStopping, turnStartedAt, threadId };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { AgentEvent, AgentJobResponse, AgentStartResponse } from '@/lib/agent-events';

/*
 * The chat transcript. Tool activity is a sibling of the messages rather than
 * a field on one: a turn can call several tools before it says anything, and
 * they should appear as they happen instead of retroactively inside a bubble
 * that does not exist yet.
 */
export type ChatEntry =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | {
    id: string;
    kind: 'tool';
    tool: string;
    args?: unknown;
    output?: string;
    status: 'running' | 'done';
  }
  | { id: string; kind: 'reasoning'; text: string }
  | { id: string; kind: 'file'; filename: string; url: string }
  | { id: string; kind: 'stopped'; message: string };

export type ChatStatus = 'ready' | 'submitted' | 'streaming';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `e${counter}`;
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
  const [error, setError] = useState<Error | undefined>();

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
    async (text: string) => {
      const message = text.trim();
      if (!message || status !== 'ready') return;

      setError(undefined);
      setStatus('submitted');
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
                { id, kind: 'message', role: 'assistant', text: '' },
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
              { id, kind: 'tool', tool: event.tool, args: event.args, status: 'running' },
            ]);
            break;
          }
          case 'tool_result': {
            const queue = pendingToolCalls.get(event.tool);
            const id = queue?.shift();
            if (id) {
              setEntries((prev) =>
                prev.map((entry) =>
                  entry.id === id && entry.kind === 'tool'
                    ? { ...entry, output: event.output, status: 'done' }
                    : entry,
                ),
              );
            } else {
              // A result with no matching call (e.g. reconnect mid-turn)
              // still deserves a line rather than being dropped silently.
              setEntries((prev) => [
                ...prev,
                { id: nextId(), kind: 'tool', tool: event.tool, output: event.output, status: 'done' },
              ]);
            }
            break;
          }
          case 'file':
            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'file', filename: event.filename, url: event.url },
            ]);
            break;
          case 'stopped':
            setEntries((prev) => [
              ...prev,
              { id: nextId(), kind: 'stopped', message: event.message },
            ]);
            break;
          case 'error':
            setError(new Error(event.message));
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
          body: JSON.stringify({ message, thread_id: threadId }),
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
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        jobIdRef.current = null;
        setStatus('ready');
      }
    },
    [status, token, threadId],
  );

  return { entries, status, error, sendMessage, stop, threadId };
}

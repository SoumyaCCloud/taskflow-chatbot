'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { drainEvents } from '@/lib/agent-events';

/*
 * The chat transcript. Tool activity is a sibling of the messages rather than
 * a field on one: a turn can call several tools before it says anything, and
 * they should appear as they happen instead of retroactively inside a bubble
 * that does not exist yet.
 */
export type ChatEntry =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; text: string }
  | { id: string; kind: 'tool'; tool: string; args?: unknown; output?: string };

export type ChatStatus = 'ready' | 'submitted' | 'streaming';

let counter = 0;
function nextId(): string {
  counter += 1;
  return `e${counter}`;
}

/**
 * Speaks the agent's SSE protocol from the browser.
 *
 * `EventSource` can't be used: it is GET-only and cannot set headers, while this
 * endpoint needs POST, a JSON body and an Authorization header — so the stream
 * is read off `fetch` by hand.
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

  useEffect(() => {
    // A stream left running after unmount keeps writing into dead state.
    return () => abortRef.current?.abort();
  }, []);

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

      // The answer arrives token by token — it accumulates into one growing
      // bubble, created lazily so a tool-only turn doesn't leave an empty one.
      let answerId: string | null = null;

      const appendToken = (content: string) => {
        setEntries((prev) => {
          if (answerId === null) return prev;
          const id = answerId;
          return prev.map((entry) =>
            entry.id === id && entry.kind === 'message'
              ? { ...entry, text: entry.text + content }
              : entry,
          );
        });
      };

      try {
        const response = await fetch('/api/agent', {
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

        if (!response.ok || !response.body) {
          const detail = await response.text().catch(() => '');
          throw new Error(detail || `Request failed (HTTP ${response.status}).`);
        }

        setStatus('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // `stream: true` so a multi-byte character split across two network
          // chunks is held back rather than decoded into a replacement char.
          buffer += decoder.decode(value, { stream: true });

          const { events, rest } = drainEvents(buffer);
          buffer = rest;

          for (const event of events) {
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
                appendToken(event.content);
                break;
              }
              case 'tool_call':
                setEntries((prev) => [
                  ...prev,
                  { id: nextId(), kind: 'tool', tool: event.tool, args: event.args },
                ]);
                break;
              case 'tool_result':
                setEntries((prev) => [
                  ...prev,
                  { id: nextId(), kind: 'tool', tool: event.tool, output: event.output },
                ]);
                break;
              case 'error':
                setError(new Error(event.message));
                break;
              case 'done':
                // Nothing to do — the reader ends with the stream.
                break;
            }
          }
        }
      } catch (err) {
        // Aborting is our own doing (unmount), not something to report.
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStatus('ready');
      }
    },
    [status, token, threadId],
  );

  return { entries, status, error, sendMessage, threadId };
}

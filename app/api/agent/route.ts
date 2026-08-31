import { google } from '@ai-sdk/google';
import { streamText, type ModelMessage } from 'ai';

import { encodeEvent, type AgentEvent, type AgentRequest } from '@/lib/agent-events';
import { readSessionToken } from '@/lib/shell-session';

// Long agent turns (tool calls, then a written answer) need more than the
// default; the client keeps its bubble open for the whole window.
export const maxDuration = 30;

// SSE is a live connection — nothing about it may be cached or prerendered.
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT =
  "You are a helpful assistant that provides concise and accurate answers to user questions. If you are asked any prompt about calculation don't answer it, instead respond with 'I am not able to perform calculations.'";

/*
 * Where the real TaskFlow agent lives. When it is configured this route is a
 * pass-through: the browser posts same-origin (so there is no cross-origin
 * preflight on every turn, and the bearer never leaves our own origin from
 * client JS) and the upstream SSE stream is piped back untouched.
 *
 * Unset — local development against Gemini — the same protocol is generated
 * here instead, so the UI and the standalone test page behave identically
 * either way.
 */
const UPSTREAM = process.env.TASKFLOW_AGENT_URL;

/**
 * Local-mode conversation memory. The protocol sends only the newest message
 * plus a `thread_id`, so history has to live on this side. Process-local and
 * lost on restart, which is the right trade for a dev fallback — the real
 * agent service owns durable history.
 */
const threads = new Map<string, ModelMessage[]>();
const MAX_THREADS = 100;
const MAX_HISTORY = 40;

function historyFor(threadId: string): ModelMessage[] {
  const existing = threads.get(threadId);
  if (existing) return existing;

  // Oldest-first eviction so a long-lived dev server can't grow without bound.
  if (threads.size >= MAX_THREADS) {
    const oldest = threads.keys().next().value;
    if (oldest !== undefined) threads.delete(oldest);
  }

  const fresh: ModelMessage[] = [];
  threads.set(threadId, fresh);
  return fresh;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  // no-transform matters as much as no-cache: a proxy that "helpfully"
  // compresses or rebuffers the body turns a live stream into one late blob.
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  // nginx-specific opt-out of the same buffering.
  'X-Accel-Buffering': 'no',
} as const;

function badRequest(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

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
function resolveBearer(req: Request): string | null {
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

export async function POST(req: Request) {
  const authorization = resolveBearer(req);

  // Only reachable in production: development always resolves a bearer so the
  // chat stays usable outside the shell.
  if (!authorization) {
    return badRequest('Missing bearer token.', 401);
  }

  let body: Partial<AgentRequest>;
  try {
    body = (await req.json()) as Partial<AgentRequest>;
  } catch {
    return badRequest('Body must be JSON.', 400);
  }

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const threadId = typeof body.thread_id === 'string' ? body.thread_id.trim() : '';

  if (!message) return badRequest('`message` is required.', 400);
  if (!threadId) return badRequest('`thread_id` is required.', 400);

  return UPSTREAM
    ? forwardToAgent(UPSTREAM, { message, thread_id: threadId }, authorization, req.signal)
    : streamFromModel({ message, thread_id: threadId }, req.signal);
}

/** Pass-through to the real agent: same body, same bearer, same stream back. */
async function forwardToAgent(
  url: string,
  payload: AgentRequest,
  authorization: string | null,
  signal: AbortSignal,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        // Omitted rather than sent empty when there is no session at all: a
        // blank bearer reads as a malformed credential to most gateways.
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    console.error('[agent] upstream unreachable:', error);
    return singleEventStream({
      type: 'error',
      message: 'The agent service is unreachable.',
    });
  }

  if (!upstream.ok || !upstream.body) {
    // Surfaced as the status the client already knows how to render, rather
    // than dressed up as a successful stream carrying a failure.
    const detail = await upstream.text().catch(() => '');
    console.error('[agent] upstream error:', upstream.status, detail);
    return new Response(detail || 'Agent request failed.', { status: upstream.status });
  }

  return new Response(upstream.body, { headers: SSE_HEADERS });
}

/** Local fallback: the same event protocol, generated from Gemini. */
function streamFromModel(payload: AgentRequest, signal: AbortSignal): Response {
  const history = historyFor(payload.thread_id);
  const messages: ModelMessage[] = [
    ...history,
    { role: 'user', content: payload.message },
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = '';
      let closed = false;

      const send = (event: AgentEvent) => {
        if (closed) return;
        controller.enqueue(encoder.encode(encodeEvent(event)));
      };

      try {
        const result = streamText({
          model: google('gemini-3.6-flash'),
          system: SYSTEM_PROMPT,
          messages,
          abortSignal: signal,
        });

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              answer += part.text;
              send({ type: 'token', content: part.text });
              break;
            case 'tool-call':
              send({ type: 'tool_call', tool: part.toolName, args: part.input });
              break;
            case 'tool-result':
              send({
                type: 'tool_result',
                tool: part.toolName,
                output:
                  typeof part.output === 'string'
                    ? part.output
                    : JSON.stringify(part.output),
              });
              break;
            case 'error':
              // The SDK masks stream errors so server detail is not leaked;
              // the real cause goes to the server log either way.
              console.error('[agent] stream error:', part.error);
              send({
                type: 'error',
                message:
                  process.env.NODE_ENV === 'development'
                    ? String(part.error)
                    : 'An error occurred.',
              });
              break;
            default:
              break;
          }
        }

        // Only a turn that actually produced an answer is worth remembering —
        // committing a half-streamed reply would poison the next turn.
        if (answer) {
          history.push({ role: 'user', content: payload.message });
          history.push({ role: 'assistant', content: answer });
          if (history.length > MAX_HISTORY) {
            history.splice(0, history.length - MAX_HISTORY);
          }
        }
      } catch (error) {
        // An aborted request is the user navigating away, not a failure.
        if (!signal.aborted) {
          console.error('[agent] generation failed:', error);
          send({ type: 'error', message: 'The assistant could not answer that.' });
        }
      } finally {
        // `done` always goes out, so the client never leaves a bubble pending.
        send({ type: 'done' });
        closed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/** A one-shot error stream, for failures that happen before the stream opens. */
function singleEventStream(event: AgentEvent): Response {
  const body = encodeEvent(event) + encodeEvent({ type: 'done' });
  return new Response(body, { headers: SSE_HEADERS });
}

import { google } from '@ai-sdk/google';
import { streamText, type ModelMessage } from 'ai';

import { createLocalJob, historyFor, resolveBearer, MAX_HISTORY, type LocalJob } from '@/lib/agent-server';
import type { AgentRequest, AgentStartResponse } from '@/lib/agent-events';

// A turn can run several tool calls before it answers; this is headroom for
// the local (Gemini) fallback's background generation, not for this request,
// which itself now returns almost instantly either way.
export const maxDuration = 30;

// Starting a job is never something to cache or prerender.
export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT =
  "You are a helpful assistant that provides concise and accurate answers to user questions. If you are asked any prompt about calculation don't answer it, instead respond with 'I am not able to perform calculations.'";

/*
 * Where the real TaskFlow agent lives. When it is configured this route is a
 * thin pass-through: the browser posts same-origin (so there is no
 * cross-origin preflight on every turn, and the bearer never leaves our own
 * origin from client JS), we start the job upstream and hand its id straight
 * back — the client then polls GET /api/agent/{job_id}, which proxies to the
 * same upstream in turn.
 *
 * Unset — local development against Gemini — the same job/poll protocol is
 * generated here instead, so the UI behaves identically either way.
 */
const UPSTREAM = process.env.TASKFLOW_AGENT_URL;

function badRequest(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
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
    ? startUpstreamJob(UPSTREAM, { message, thread_id: threadId }, authorization)
    : startLocalJob({ message, thread_id: threadId });
}

/** Pass-through to the real agent: same body, same bearer, its job id handed straight back. */
async function startUpstreamJob(
  url: string,
  payload: AgentRequest,
  authorization: string | null,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Omitted rather than sent empty when there is no session at all: a
        // blank bearer reads as a malformed credential to most gateways.
        ...(authorization ? { Authorization: authorization } : {}),
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error('[agent] upstream unreachable:', error);
    return Response.json({ error: 'The agent service is unreachable.' }, { status: 502 });
  }

  const detail = await upstream.text().catch(() => '');

  if (!upstream.ok) {
    // Surfaced as the status the client already knows how to render, rather
    // than dressed up as a successful job that never progresses.
    console.error('[agent] upstream start failed:', upstream.status, detail);
    return new Response(detail || 'Agent request failed.', { status: upstream.status });
  }

  return new Response(detail, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Local fallback: the same job/poll protocol, generated from Gemini in the background. */
function startLocalJob(payload: AgentRequest): Response {
  const jobId = crypto.randomUUID();
  const job = createLocalJob(jobId);

  // Fire-and-forget: the response below returns immediately, and generation
  // continues after. Safe here because `next dev`/`next start` is a
  // long-lived Node process rather than a per-request function — the one
  // reason it's safe is that this path never runs once TASKFLOW_AGENT_URL is
  // set, i.e. never in production.
  void runLocalJob(job, payload);

  const response: AgentStartResponse = { job_id: jobId };
  return Response.json(response);
}

async function runLocalJob(job: LocalJob, payload: AgentRequest): Promise<void> {
  const history = historyFor(payload.thread_id);
  const messages: ModelMessage[] = [...history, { role: 'user', content: payload.message }];
  let answer = '';

  try {
    const result = streamText({
      model: google('gemini-3.6-flash'),
      system: SYSTEM_PROMPT,
      messages,
      abortSignal: job.controller.signal,
    });

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          answer += part.text;
          job.events.push({ type: 'token', content: part.text });
          break;
        case 'tool-call':
          job.events.push({ type: 'tool_call', tool: part.toolName, args: part.input });
          break;
        case 'tool-result':
          job.events.push({
            type: 'tool_result',
            tool: part.toolName,
            output:
              typeof part.output === 'string' ? part.output : JSON.stringify(part.output),
          });
          break;
        case 'error':
          // The SDK masks stream errors so server detail is not leaked;
          // the real cause goes to the server log either way.
          console.error('[agent] stream error:', part.error);
          job.events.push({
            type: 'error',
            message:
              process.env.NODE_ENV === 'development' ? String(part.error) : 'An error occurred.',
          });
          break;
        default:
          break;
      }
    }

    // A stop request already pushed its own event and flipped the status —
    // stopLocalJob owns that outcome, so leave it alone here. Guards both the
    // case where aborting throws (below) and where fullStream just ends
    // quietly instead.
    if (job.status === 'running') {
      // Only a turn that actually produced an answer is worth remembering —
      // committing a half-generated reply would poison the next turn.
      if (answer) {
        history.push({ role: 'user', content: payload.message });
        history.push({ role: 'assistant', content: answer });
        if (history.length > MAX_HISTORY) {
          history.splice(0, history.length - MAX_HISTORY);
        }
      }
      job.status = 'completed';
    }
  } catch (error) {
    // stopLocalJob's abort() is expected to unwind the stream as a rejection;
    // that is a stop, not a failure, and it already recorded its own event.
    if (job.controller.signal.aborted) return;

    console.error('[agent] generation failed:', error);
    job.events.push({ type: 'error', message: 'The assistant could not answer that.' });
    job.status = 'error';
  }
}

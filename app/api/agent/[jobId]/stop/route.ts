import { resolveBearer, stopLocalJob } from '@/lib/agent-server';

// Stopping a job is an action, never something to cache.
export const dynamic = 'force-dynamic';

/** Same switch `POST /api/agent` uses — see the comment there. */
const UPSTREAM = process.env.TASKFLOW_AGENT_URL;

export async function POST(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  return UPSTREAM ? stopUpstreamJob(UPSTREAM, jobId, resolveBearer(req)) : stopLocalJobRoute(jobId);
}

/**
 * Pass-through stop: same job id, same bearer. The client doesn't wait on
 * this to update the transcript — it just keeps polling the job as normal,
 * and the `stopped` event this produces (plus the status leaving "running")
 * arrives through that same poll loop.
 */
async function stopUpstreamJob(
  url: string,
  jobId: string,
  authorization: string | null,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, '')}/${jobId}/stop`, {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
    });
  } catch (error) {
    console.error('[agent] stop unreachable:', error);
    return Response.json({ error: 'The agent service is unreachable.' }, { status: 502 });
  }

  const detail = await upstream.text().catch(() => '');

  if (!upstream.ok) {
    console.error('[agent] stop failed:', upstream.status, detail);
    return new Response(detail || 'Stop request failed.', { status: upstream.status });
  }

  return new Response(detail, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stopLocalJobRoute(jobId: string): Response {
  const stopped = stopLocalJob(jobId);
  if (!stopped) {
    return Response.json({ error: 'Unknown or already finished job.' }, { status: 404 });
  }
  return Response.json({ ok: true });
}

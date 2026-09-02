import { getLocalJob, resolveBearer } from '@/lib/agent-server';
import type { AgentJobResponse } from '@/lib/agent-events';

// A poll's answer is only ever a snapshot of a job in progress.
export const dynamic = 'force-dynamic';

/** Same switch `POST /api/agent` uses — see the comment there. */
const UPSTREAM = process.env.TASKFLOW_AGENT_URL;

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  return UPSTREAM ? pollUpstreamJob(UPSTREAM, jobId, resolveBearer(req)) : pollLocalJob(jobId);
}

/** Pass-through poll: same job id, same bearer, the upstream's snapshot handed straight back. */
async function pollUpstreamJob(
  url: string,
  jobId: string,
  authorization: string | null,
): Promise<Response> {
  let upstream: Response;
  try {
    upstream = await fetch(`${url.replace(/\/$/, '')}/${jobId}`, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  } catch (error) {
    console.error('[agent] poll unreachable:', error);
    return Response.json({ error: 'The agent service is unreachable.' }, { status: 502 });
  }

  const detail = await upstream.text().catch(() => '');

  if (!upstream.ok) {
    console.error('[agent] poll failed:', upstream.status, detail);
    return new Response(detail || 'Agent polling failed.', { status: upstream.status });
  }

  return new Response(detail, {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pollLocalJob(jobId: string): Response {
  const job = getLocalJob(jobId);
  if (!job) return Response.json({ error: 'Unknown job.' }, { status: 404 });

  const response: AgentJobResponse = { status: job.status, events: job.events };
  return Response.json(response);
}

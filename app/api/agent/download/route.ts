import { resolveBearer } from '@/lib/agent-server';

// Never cache someone else's file under a shared key.
export const dynamic = 'force-dynamic';

const UPSTREAM = process.env.TASKFLOW_AGENT_URL;

function badRequest(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Proxies a file a `file` event pointed at. A plain `<a href>` straight to the
 * agent's own host would work for the reference test harness (its download
 * link carries no Authorization header at all — the file id itself seems to
 * be the only capability needed, and the file is deleted server-side on
 * first fetch regardless of how that fetch was made), but doing that from the
 * browser would still mean either leaking the bearer to a third-party origin
 * or, if the token turns out to matter after all, having no way to attach it
 * from a navigation. Routing through here avoids both without assuming which
 * way the real backend behaves: the bearer is forwarded when we have one,
 * but — unlike the rest of this API — its absence isn't treated as a 401.
 *
 * The target is restricted to the configured agent origin so a crafted `url`
 * query param can't turn this into an open SSRF relay to an arbitrary host —
 * there is no real fallback here because file downloads only exist once a
 * real agent (TASKFLOW_AGENT_URL) is configured; the local Gemini fallback
 * never emits `file` events.
 */
export async function GET(req: Request) {
  if (!UPSTREAM) {
    return badRequest('File downloads are not available in local development.', 501);
  }

  const requestUrl = new URL(req.url);
  const target = requestUrl.searchParams.get('url');
  const filename = requestUrl.searchParams.get('filename') || 'download';

  if (!target) return badRequest('`url` is required.', 400);

  let resolved: URL;
  try {
    // A relative path (the common case — "/files/{id}") resolves against the
    // agent's own origin; an absolute URL is parsed as-is and checked below.
    resolved = new URL(target, UPSTREAM);
  } catch {
    return badRequest('`url` is not a valid URL.', 400);
  }

  if (resolved.origin !== new URL(UPSTREAM).origin) {
    return badRequest('`url` must be on the agent host.', 400);
  }

  const authorization = resolveBearer(req);

  let upstream: Response;
  try {
    upstream = await fetch(resolved, {
      headers: authorization ? { Authorization: authorization } : {},
    });
  } catch (error) {
    console.error('[agent] file download unreachable:', error);
    return Response.json({ error: 'The file service is unreachable.' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    console.error('[agent] file download failed:', upstream.status, detail);
    return new Response(detail || 'File download failed.', { status: upstream.status });
  }

  // Stripped rather than escaped: a filename that ultimately came from the
  // agent's own response has no business carrying header-breaking characters.
  const safeName = filename.replace(/["\r\n]/g, '').slice(0, 255) || 'download';
  const encodedName = encodeURIComponent(filename)
    .replace(/['()]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/\*/g, '%2A');

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream');
  const length = upstream.headers.get('content-length');
  if (length) headers.set('Content-Length', length);
  // Both forms: the plain one for older clients, the UTF-8 one (RFC 5987) so
  // a non-ASCII filename survives instead of being mangled to `safeName`.
  headers.set(
    'Content-Disposition',
    `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
  );

  return new Response(upstream.body, { headers });
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { encodeForHeader } from '@/lib/shell-user';

/*
 * The shell embeds this app cross-origin in an <iframe>, so neither the
 * taskflow_theme nor the taskflow_session cookie reaches us — it passes the
 * theme and the signed-in user's name on the URL instead:
 *
 *   /?theme=dark&name=Soumyabroto+Das
 *
 * Layouts can't read searchParams, so lift them off the URL here and hand them
 * to the root layout as request headers.
 */
export function proxy(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const fromUrl = params.get('theme');
  const fromCookie = request.cookies.get('taskflow_theme')?.value;

  // Dark is the default per PRD/11-design-tokens.md.
  const theme = (fromUrl ?? fromCookie) === 'light' ? 'light' : 'dark';

  const headers = new Headers(request.headers);
  headers.set('x-taskflow-theme', theme);

  const name = encodeForHeader(params.get('name'));

  // Deleted rather than left alone: without this a caller could spoof identity
  // by sending the header directly, and a stale value could survive a rewrite.
  if (name) headers.set('x-taskflow-name', name);
  else headers.delete('x-taskflow-name');

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Pages only — skip static assets and the chat streaming endpoint.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

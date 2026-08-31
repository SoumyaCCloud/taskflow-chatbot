/*
 * The bearer the agent endpoint wants. It reaches us the same way the theme and
 * the user's name do — on the iframe URL — because the cross-origin frame never
 * receives the taskflow_session cookie:
 *
 *   /?theme=dark&name=Soumyabroto+Das&token=<jwt>
 *
 * proxy.ts lifts it onto a request header, the root layout reads that header,
 * and the chat sends it back up as `Authorization: Bearer …` on every turn.
 */

/** Long enough for a signed JWT, short enough that a junk URL can't blow out the header. */
const MAX_TOKEN = 4096;

/**
 * Header values are latin-1 and must not contain control characters, so anything
 * that isn't a plausible token character is rejected outright rather than
 * escaped — a real token is base64url plus dots.
 */
const TOKEN_PATTERN = /^[A-Za-z0-9._~+/=-]+$/;

export function readSessionToken(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || trimmed.length > MAX_TOKEN) return '';
  return TOKEN_PATTERN.test(trimmed) ? trimmed : '';
}

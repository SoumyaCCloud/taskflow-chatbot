/*
 * The shell identifies the signed-in user on the iframe URL alongside the theme
 * (?theme=dark&name=Soumyabroto+Das) because the cross-origin frame never
 * receives the taskflow_session cookie. The full name is all it sends — the
 * avatar's initials are derived here rather than passed.
 */

/** Guards against a name long enough to blow out the header or the greeting. */
const MAX_NAME = 64;

/**
 * Header values are latin-1 only and names are not, so the proxy percent-encodes
 * what it lifts off the query string and the layout decodes it here.
 */
export function encodeForHeader(value: string | null): string | null {
  const trimmed = value?.trim().slice(0, MAX_NAME);
  return trimmed ? encodeURIComponent(trimmed) : null;
}

export function decodeFromHeader(value: string | null): string {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    // A hand-edited URL can carry a malformed escape; fall back to the raw text.
    return value;
  }
}

function words(name: string): string[] {
  return name.trim().split(/\s+/).filter(Boolean);
}

/**
 * First + last initial ("Soumyabroto Das" → "SD"), falling back to a single
 * glyph for a mononym. Indexed by code point rather than by UTF-16 unit so an
 * astral first character isn't cut into half a surrogate pair.
 */
export function initialsFromName(name: string): string {
  const parts = words(name);
  if (parts.length === 0) return '';

  const first = [...parts[0]][0] ?? '';
  const last = parts.length > 1 ? ([...parts[parts.length - 1]][0] ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** What you'd actually be called — the greeting doesn't want the surname. */
export function firstNameFrom(name: string): string {
  return words(name)[0] ?? '';
}

/**
 * Download and Preview both read the same agent file through the same
 * same-origin proxy. The reference agent deletes a file server-side on its
 * first fetch (see app/api/agent/download/route.ts), so previewing a file
 * and then downloading it — or the reverse — would otherwise make the
 * second request 404. Caching the in-flight/completed fetch per proxy URL
 * means whichever action happens first is the only one that ever hits the
 * server; the other just reads the same Blob.
 */
const inflight = new Map<string, Promise<Blob>>();

export function buildDownloadProxyUrl(url: string, filename: string): string {
  return `/api/agent/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
}

export function fetchFileOnce(proxyUrl: string, token: string): Promise<Blob> {
  const cached = inflight.get(proxyUrl);
  if (cached) return cached;

  const promise = fetch(proxyUrl, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    .then((response) => {
      if (!response.ok) throw new Error(`Request failed (HTTP ${response.status}).`);
      return response.blob();
    })
    .catch((error: unknown) => {
      // A failed attempt shouldn't poison the cache — let a retry go through.
      inflight.delete(proxyUrl);
      throw error;
    });

  inflight.set(proxyUrl, promise);
  return promise;
}

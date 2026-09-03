'use client';

import { CircleAlert, Download, FileText, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

/*
 * A file the agent produced. `url` lives on the agent's own host behind the
 * same bearer as chat, so this can't be a plain `<a href>` — a browser
 * navigation can't attach an Authorization header, and doing it client-side
 * would mean sending the token to a third-party origin. Instead this fetches
 * the file through our own same-origin proxy (which attaches the bearer
 * server-side) and hands the browser the result as a blob to save.
 */
export function FileEvent({
  filename,
  url,
  token,
}: {
  filename: string;
  url: string;
  token: string;
}) {
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle');

  const handleDownload = async () => {
    if (state === 'downloading') return;
    setState('downloading');

    try {
      const proxyUrl = `/api/agent/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
      const response = await fetch(proxyUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}).`);

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);

      setState('idle');
    } catch {
      setState('error');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start pl-10"
    >
      <button
        type="button"
        onClick={handleDownload}
        disabled={state === 'downloading'}
        className="flex w-full max-w-[85%] cursor-pointer items-center gap-3 rounded-2xl border border-border-subtle bg-bg-700 px-4 py-3 text-left shadow-card transition-colors hover:border-accent/50 hover:bg-bg-600 disabled:cursor-wait"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-accent">
          <FileText size={18} strokeWidth={2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-100">{filename}</span>
          <span className="block text-xs text-text-300">
            {state === 'error'
              ? 'Download failed — click to retry'
              : state === 'downloading'
                ? 'Downloading…'
                : 'Click to download'}
          </span>
        </span>

        {state === 'downloading' ? (
          <LoaderCircle size={16} strokeWidth={2} className="shrink-0 animate-spin text-text-300" />
        ) : state === 'error' ? (
          <CircleAlert size={16} strokeWidth={2} className="shrink-0 text-status-red" />
        ) : (
          <Download size={16} strokeWidth={2} className="shrink-0 text-text-300" />
        )}
      </button>
    </motion.div>
  );
}

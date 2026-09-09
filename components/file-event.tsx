'use client';

import { CircleAlert, Download, Eye, FileText, LoaderCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';

import { buildDownloadProxyUrl, fetchFileOnce } from '@/lib/file-fetch-cache';
import { getPreviewKind } from '@/lib/file-preview';
import type { PreviewTarget } from '@/components/preview-panel';

/*
 * A file the agent produced. `url` lives on the agent's own host, so this
 * can't be a plain `<a href>` — a browser navigation can't attach an
 * Authorization header, and doing it client-side would mean sending the
 * token to a third-party origin even if the endpoint turns out not to need
 * it. Instead this fetches the file through our own same-origin proxy
 * (which forwards the bearer server-side when there is one) and hands the
 * browser the result as a blob to save.
 */
export function FileEvent({
  filename,
  url,
  token,
  onPreview,
}: {
  filename: string;
  url: string;
  token: string;
  onPreview?: (file: PreviewTarget) => void;
}) {
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle');
  const previewKind = getPreviewKind(filename);

  const handleDownload = async () => {
    if (state === 'downloading') return;
    setState('downloading');

    try {
      const proxyUrl = buildDownloadProxyUrl(url, filename);
      const blob = await fetchFileOnce(proxyUrl, token);

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
      {/* The card itself is inert — no click target of its own — so Preview
          and Download can each be their own explicit action instead of one
          overloading the whole row. */}
      <div className="flex w-full max-w-[85%] items-center gap-3 rounded-2xl border border-border-subtle bg-bg-700 px-4 py-3 shadow-card">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-bg text-accent">
          <FileText size={18} strokeWidth={2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text-100">{filename}</span>
          <span className="block text-xs text-text-300">
            {state === 'error'
              ? 'Download failed — try again'
              : state === 'downloading'
                ? 'Downloading…'
                : previewKind
                  ? 'Ready to preview or download'
                  : 'Ready to download'}
          </span>
        </span>

        <div className="flex shrink-0 items-center gap-2">
          {previewKind && (
            <button
              type="button"
              onClick={() => onPreview?.({ filename, url })}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-800 px-2.5 py-1.5 text-xs font-medium text-text-200 transition-colors hover:border-accent/50 hover:bg-bg-600 hover:text-text-100"
            >
              <Eye size={14} strokeWidth={2} />
              Preview
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={state === 'downloading'}
            className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-subtle bg-bg-800 px-2.5 py-1.5 text-xs font-medium text-text-200 transition-colors hover:border-accent/50 hover:bg-bg-600 hover:text-text-100 disabled:cursor-wait disabled:opacity-70"
          >
            {state === 'downloading' ? (
              <LoaderCircle size={14} strokeWidth={2} className="animate-spin" />
            ) : state === 'error' ? (
              <CircleAlert size={14} strokeWidth={2} className="text-status-red" />
            ) : (
              <Download size={14} strokeWidth={2} />
            )}
            {state === 'error' ? 'Retry' : 'Download'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

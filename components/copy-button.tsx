'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

/** Sits under an assistant bubble, same spot Claude puts it — muted until asked for. */
export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard permission denied or unavailable — nothing more to do.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Copied' : 'Copy response'}
      className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-300 transition-colors hover:bg-bg-700 hover:text-text-100"
    >
      {copied ? (
        <Check size={13} strokeWidth={2} className="text-status-green" />
      ) : (
        <Copy size={13} strokeWidth={2} />
      )}
    </button>
  );
}

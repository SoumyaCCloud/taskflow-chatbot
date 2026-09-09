'use client';

import { CircleAlert, LoaderCircle, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';
import * as XLSX from 'xlsx';

import { buildDownloadProxyUrl, fetchFileOnce } from '@/lib/file-fetch-cache';
import { getPreviewKind } from '@/lib/file-preview';

export type PreviewTarget = { filename: string; url: string };

const MIN_WIDTH = 360;
const MAX_WIDTH = 840;
const DEFAULT_WIDTH = 480;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type SpreadsheetSheets = Record<string, string[][]>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'pdf'; objectUrl: string }
  | { status: 'markdown'; text: string }
  | { status: 'spreadsheet'; sheetNames: string[]; sheets: SpreadsheetSheets };

/*
 * Docked to the right of the chat column rather than an overlay — it shares
 * the viewport with the transcript instead of covering it, and its width is
 * user-draggable (the left edge is the resize handle) since a single fixed
 * width can't fit a one-column CSV and a wide spreadsheet equally well.
 */
export function PreviewPanel({
  file,
  token,
  onClose,
}: {
  file: PreviewTarget | null;
  token: string;
  onClose: () => void;
}) {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isDragging, setIsDragging] = useState(false);
  const [isHandleHovered, setIsHandleHovered] = useState(false);
  const dragStartRef = useRef({ x: 0, width: DEFAULT_WIDTH });
  // Driven by explicit enter/leave + the drag flag rather than CSS `:hover` —
  // native hover can read as "stuck" once a drag has moved the pointer
  // through other elements, since nothing then fires the handle's own
  // mouseleave. This is always in sync with where the pointer actually is.
  const isHandleActive = isDragging || isHandleHovered;

  const [state, setState] = useState<LoadState | null>(null);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  // Derived straight from the prop rather than mirrored into state: it's
  // knowable synchronously on every render, so there's nothing to "load".
  const previewKind = file ? getPreviewKind(file.filename) : null;

  useEffect(() => {
    if (!isDragging) return;

    // Forced for the duration of the drag so the resize cursor stays
    // consistent even while the pointer is over the chat column or the
    // preview content, not just the 4px handle strip — and so dragging
    // across text (message bubbles, table cells) doesn't select it.
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (e: PointerEvent) => {
      // Dragging left grows the panel (it's anchored to the right edge), so
      // the delta is start-minus-current, not the other way round.
      const delta = dragStartRef.current.x - e.clientX;
      setWidth(clamp(dragStartRef.current.width + delta, MIN_WIDTH, MAX_WIDTH));
    };
    const onUp = () => setIsDragging(false);

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    // Nothing renders while there's no file (or an unsupported one — see the
    // `previewKind` guard below) so `state` is left as-is rather than reset;
    // it'll be overwritten the moment a previewable file is opened.
    if (!file || !previewKind) return;

    let cancelled = false;

    (async () => {
      // Inside the async callback rather than the effect body itself so this
      // is the render-triggered-by-an-external-event React wants, not a
      // synchronous cascade off the effect's own commit.
      setState({ status: 'loading' });
      setActiveSheet(null);

      try {
        const proxyUrl = buildDownloadProxyUrl(file.url, file.filename);
        const blob = await fetchFileOnce(proxyUrl, token);
        if (cancelled) return;

        if (previewKind === 'pdf') {
          const objectUrl = URL.createObjectURL(blob);
          objectUrlRef.current = objectUrl;
          setState({ status: 'pdf', objectUrl });
        } else if (previewKind === 'markdown') {
          setState({ status: 'markdown', text: await blob.text() });
        } else {
          const workbook = XLSX.read(await blob.arrayBuffer(), { type: 'array' });
          const sheets: SpreadsheetSheets = {};
          for (const name of workbook.SheetNames) {
            sheets[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
              header: 1,
              blankrows: false,
            }) as string[][];
          }
          if (cancelled) return;
          setState({ status: 'spreadsheet', sheetNames: workbook.SheetNames, sheets });
          setActiveSheet(workbook.SheetNames[0] ?? null);
        }
      } catch (error) {
        if (cancelled) return;
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Preview failed.',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [file, previewKind, token]);

  // Belt-and-suspenders: also revoke on unmount, in case the panel closes
  // mid-preview rather than switching to another file.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {file && (
        <motion.div
          key={file.url}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          style={{ width }}
          className="relative flex h-full shrink-0 flex-col border-l border-border-subtle bg-bg-800"
        >
          {/* A wide (16px) invisible hit target with a slim visible bar
              centered in it — matches how VS Code / Linear-style split panes
              size their drag handles, since a bar 3-4px wide is nearly
              impossible to grab reliably on its own. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview panel"
            onPointerDown={(e) => {
              dragStartRef.current = { x: e.clientX, width };
              setIsDragging(true);
            }}
            onMouseEnter={() => setIsHandleHovered(true)}
            onMouseLeave={() => setIsHandleHovered(false)}
            className="absolute -left-2 top-0 z-10 flex h-full w-4 cursor-col-resize touch-none items-stretch justify-center"
          >
            <div
              className={`w-[3px] rounded-full transition-colors duration-150 ${
                isHandleActive ? 'bg-accent' : 'bg-transparent'
              }`}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
            <span className="min-w-0 truncate text-sm font-medium text-text-100">{file.filename}</span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-text-300 transition-colors hover:bg-bg-600 hover:text-text-100"
            >
              <X size={16} strokeWidth={2} />
            </button>
          </div>

          {state?.status === 'spreadsheet' && state.sheetNames.length > 1 && (
            <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-3 py-2 no-scrollbar">
              {state.sheetNames.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveSheet(name)}
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    name === activeSheet
                      ? 'bg-accent-bg text-accent'
                      : 'text-text-300 hover:bg-bg-600 hover:text-text-100'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto">
            {!previewKind && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <CircleAlert size={20} strokeWidth={2} className="text-status-red" />
                <p className="text-sm text-text-300">Preview is not supported for this file type.</p>
              </div>
            )}

            {previewKind && (!state || state.status === 'loading') && (
              <div className="flex h-full items-center justify-center text-text-300">
                <LoaderCircle size={20} strokeWidth={2} className="animate-spin" />
              </div>
            )}

            {state?.status === 'error' && (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                <CircleAlert size={20} strokeWidth={2} className="text-status-red" />
                <p className="text-sm text-text-300">{state.message}</p>
              </div>
            )}

            {state?.status === 'pdf' && (
              // The #-params are the standard PDF "open parameters" — Chromium's
              // built-in viewer (and Firefox's pdf.js) honor them on a blob: URL
              // just like a normal one, hiding its own toolbar/thumbnail
              // sidebar so this reads as a plain document preview instead of a
              // second nested app chrome.
              <iframe
                src={`${state.objectUrl}#toolbar=0&navpanes=0&view=FitH`}
                title={file.filename}
                className="h-full w-full border-0"
              />
            )}

            {state?.status === 'markdown' && (
              <div className="p-4">
                <Streamdown>{state.text}</Streamdown>
              </div>
            )}

            {state?.status === 'spreadsheet' && activeSheet && (
              <div className="p-4">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {state.sheets[activeSheet]?.map((row, i) => (
                      <tr key={i} className={i === 0 ? 'bg-bg-700 font-medium text-text-100' : 'text-text-200'}>
                        {row.map((cell, j) => (
                          <td key={j} className="whitespace-nowrap border border-border-subtle px-3 py-1.5">
                            {cell ?? ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

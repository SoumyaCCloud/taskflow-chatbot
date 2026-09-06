'use client';

import { ExternalLink, Info, Waypoints } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { Tooltip } from '@/components/tooltip';
import type { MenuDirection } from '@/lib/menu-direction';

const GRAPH_VISUALIZE_URL = 'https://taskflowassistant.onrender.com/graph/visualize';

/*
 * The info chip beside the model-status Bot icon. Same click-to-open-a-
 * floating-panel pattern as ModelConfigPopover and ThinkingLevelSelect, just
 * holding a single external link instead of settings fields — a "toolbox"
 * that currently has one tool in it (the graph visualizer), left as its own
 * component so more tools can join it later without reshaping
 * ModelConfigPopover.
 */
export function GraphToolboxButton({ menuDirection }: { menuDirection: MenuDirection }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      <Tooltip content="Visualize graph" hidden={open}>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Visualize graph"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-800 text-text-300 transition-colors enabled:cursor-pointer hover:border-text-300/60 hover:text-text-200 aria-expanded:border-text-300/60 aria-expanded:text-text-200"
        >
          <Info size={18} strokeWidth={2} />
        </button>
      </Tooltip>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Toolbox"
            initial={{ opacity: 0, y: menuDirection === 'up' ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: menuDirection === 'up' ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute left-0 z-20 w-64 overflow-hidden rounded-card border border-border-subtle bg-bg-700 p-1 shadow-elevated ${menuDirection === 'up'
              ? 'bottom-full mb-2 origin-bottom-left'
              : 'top-full mt-2 origin-top-left'
              }`}
          >
            <a
              href={GRAPH_VISUALIZE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full cursor-pointer items-start gap-2 rounded-[6px] px-2.5 py-2 text-left transition-colors hover:bg-bg-600"
            >
              <Waypoints className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-text-100">
                  Visualize graph
                  <ExternalLink className="h-3 w-3 shrink-0 text-text-300" />
                </span>
                <span className="block text-[11px] leading-snug text-text-300">
                  Opens the full knowledge graph in a new tab
                </span>
              </span>
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

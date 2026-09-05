'use client';

import { Bot, Plus } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { ModelSelect } from '@/components/model-select';
import { Tooltip } from '@/components/tooltip';
import { findModelOption, type ModelSelection } from '@/lib/agent-events';
import type { MenuDirection } from '@/lib/menu-direction';

/** An option's short label, or the raw model id if it somehow isn't in the catalog. */
function labelFor(selection: ModelSelection): string {
  return findModelOption(selection)?.label ?? selection.model;
}

/*
 * The "+" chip at the composer's bottom-left, mirroring the reasoning picker
 * that sits at the bottom-right. Same click-to-open-a-floating-panel pattern
 * as ThinkingLevelSelect, just a larger panel holding two fields instead of
 * one list — a modal would yank focus off the composer entirely for what's
 * still just tweaking a couple of per-turn settings.
 */
export function ModelConfigPopover({
  modelSelection,
  onModelSelectionChange,
  summarizerModelSelection,
  onSummarizerModelSelectionChange,
  disabled = false,
  menuDirection,
}: {
  modelSelection: ModelSelection | null;
  onModelSelectionChange: (value: ModelSelection | null) => void;
  summarizerModelSelection: ModelSelection | null;
  onSummarizerModelSelectionChange: (value: ModelSelection | null) => void;
  disabled?: boolean;
  menuDirection: MenuDirection;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isOpen = open && !disabled;
  // Tinted while either field has an override, the same way a filter chip
  // stays highlighted while active — so the setting is visible even closed.
  const hasOverride = modelSelection !== null || summarizerModelSelection !== null;

  // The status chip never writes the model name where it's always visible —
  // it's an icon, tinted whenever either field is overridden, and hovering
  // is what actually reveals which ones. Two versions of the same fact: a
  // plain-text one for the accessible name (aria-label needs a string, not
  // markup) and a bulleted one for the visible, sighted-hover tooltip.
  const modelLabel = modelSelection ? labelFor(modelSelection) : null;
  const summarizerLabel = summarizerModelSelection ? labelFor(summarizerModelSelection) : null;
  const chipAccessibleLabel = `Model: ${modelLabel ?? 'Deployment default'}. Summarizer model: ${summarizerLabel ?? 'Deployment default'}.`;
  const chipTooltipContent = (
    <div className="space-y-1.5">
      <div className="font-semibold text-text-100">Active model configuration</div>
      <ul className="space-y-1">
        <li className="flex items-start gap-1.5">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
          <span className="text-text-200">Model: {modelLabel ?? 'Deployment default'}</span>
        </li>
        <li className="flex items-start gap-1.5">
          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
          <span className="text-text-200">Summarizer model: {summarizerLabel ?? 'Deployment default'}</span>
        </li>
      </ul>
    </div>
  );

  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative flex items-center gap-1.5">
      <Tooltip content="Configure models" hidden={isOpen}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label="Configure models"
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition-colors enabled:cursor-pointer enabled:hover:bg-bg-500 enabled:hover:text-text-100 disabled:cursor-not-allowed disabled:text-text-300 aria-expanded:bg-bg-500 aria-expanded:text-text-100 ${hasOverride ? 'text-accent' : 'text-text-200'
            }`}
        >
          <Plus className="h-[18px] w-[18px]" />
          <span className="hidden sm:inline">Models</span>
        </button>
      </Tooltip>

      {/* The at-a-glance status indicator — an icon only, tinted when either
          field is overridden. Sized to match the "+" trigger (h-9) rather
          than a small badge, so it reads as a real toolbar control instead
          of a barely-visible dot. Clicking it opens the same popover as the
          "+" button, but its real job is passive: hovering is what actually
          reveals which model(s) are set, nothing is written out plainly. */}
      <Tooltip content={chipTooltipContent} width="w-64" hidden={isOpen}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-label={chipAccessibleLabel}
          className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors enabled:cursor-pointer ${hasOverride
            ? 'border-accent/40 bg-accent-bg text-accent enabled:hover:border-accent/60'
            : 'border-border-subtle bg-bg-800 text-text-300 enabled:hover:border-text-300/60 enabled:hover:text-text-200'
            }`}
        >
          <Bot size={18} strokeWidth={2} />
        </button>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-label="Model configuration"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            // Always opens upward, unconditionally — unlike the fields inside
            // it (see `menuDirection` on the ModelSelects below), this panel
            // itself never flips: the "+"/status trigger sits at the very
            // bottom of the composer even when the composer is centered
            // mid-viewport on an empty chat, so there's reliably room above
            // it either way. Pinned to the trigger's left edge, wide enough
            // to hold two full-width fields comfortably.
            className="absolute bottom-full left-0 z-20 mb-2 w-80 origin-bottom-left space-y-4 rounded-card border border-border-subtle bg-bg-700 p-4 shadow-elevated sm:w-96"
          >
            <div>
              <h3 className="text-sm font-medium text-text-100">Model configuration</h3>
              <p className="mt-0.5 text-xs text-text-300">
                Applies to this turn and stays set until you change it.
              </p>
            </div>

            <ModelSelect
              label="Model"
              hint="Supervisor and every specialist — not the summarizer or the RAG embedding model, which is always Gemini."
              value={modelSelection}
              onChange={onModelSelectionChange}
              menuDirection={menuDirection}
            />

            <ModelSelect
              label="Summarizer model"
              hint="Independent of the model above — defaults to its own model when unset."
              value={summarizerModelSelection}
              onChange={onSummarizerModelSelectionChange}
              menuDirection={menuDirection}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

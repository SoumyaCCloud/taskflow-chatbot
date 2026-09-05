'use client';

import { Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { Tooltip } from '@/components/tooltip';
import { findModelOption, MODEL_GROUPS, type ModelSelection } from '@/lib/agent-events';
import type { MenuDirection } from '@/lib/menu-direction';

/*
 * One "Model" / "Summarizer model" field inside the model-config popover.
 * Same click-to-reveal-options-then-collapse pattern as ThinkingLevelSelect,
 * grouped by provider, and following the same `menuDirection` as its parent
 * popover — they flip together, so it never ends up as the one menu opening
 * the "wrong" way relative to everything else on the composer.
 */
export function ModelSelect({
  label,
  hint,
  value,
  onChange,
  disabled = false,
  menuDirection,
}: {
  label: string;
  hint: string;
  value: ModelSelection | null;
  onChange: (value: ModelSelection | null) => void;
  disabled?: boolean;
  menuDirection: MenuDirection;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const isOpen = open && !disabled;
  const selected = findModelOption(value);

  useEffect(() => {
    if (!isOpen) return;

    // Pointerdown rather than click so the menu closes on the press that
    // starts elsewhere, before that press lands on whatever is underneath —
    // including the parent popover's own close handler, which is what lets
    // clicking the *other* model field close this one instead of stacking.
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
    <div ref={containerRef} className="relative">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-text-300">
        {label}
      </span>

      <Tooltip content={hint} className="w-full" hidden={isOpen}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? menuId : undefined}
          className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-border-subtle bg-bg-800 px-3 text-[13px] text-text-100 transition-colors enabled:cursor-pointer enabled:hover:border-accent/40 disabled:cursor-not-allowed disabled:text-text-300"
        >
          <span className="truncate">{selected ? selected.label : 'Deployment default'}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-text-300 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </Tooltip>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            id={menuId}
            role="listbox"
            aria-label={label}
            initial={{ opacity: 0, y: menuDirection === 'up' ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: menuDirection === 'up' ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            className={`absolute left-0 right-0 z-30 max-h-64 overflow-y-auto rounded-card border border-border-subtle bg-bg-700 p-1 shadow-elevated ${menuDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
              }`}
          >
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-bg-600 ${value === null ? 'bg-accent-bg' : ''
                  }`}
              >
                <Check className={`h-3.5 w-3.5 shrink-0 text-accent ${value === null ? '' : 'invisible'}`} />
                <span className="text-text-100">Deployment default</span>
              </button>
            </li>

            {MODEL_GROUPS.map((group) => (
              <li key={group.provider} className="mt-1">
                <div className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-text-300">
                  {group.label}
                </div>
                <ul>
                  {group.options.map((option) => {
                    const isSelected =
                      value?.provider === option.selection.provider &&
                      value?.model === option.selection.model;
                    return (
                      <li key={option.selection.model}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            onChange(option.selection);
                            setOpen(false);
                          }}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-bg-600 ${isSelected ? 'bg-accent-bg' : ''
                            }`}
                        >
                          <Check
                            className={`h-3.5 w-3.5 shrink-0 text-accent ${isSelected ? '' : 'invisible'}`}
                          />
                          <span className="text-text-100">{option.label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

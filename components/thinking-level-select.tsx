'use client';

import { Brain, Check, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import { THINKING_LEVELS, type ThinkingLevel } from '@/lib/agent-events';

/*
 * The composer's reasoning-budget picker, sat immediately left of the send
 * button the way Gemini's model chip sits beside its own. It is a plain
 * button + absolutely positioned list rather than a native <select>: the menu
 * has to open *upwards* (the composer lives at the bottom of the viewport)
 * and carry a description per option, neither of which a <select> can do.
 *
 * The chosen level rides along with each message — see AgentRequest — so
 * switching it mid-conversation only affects the next turn, not the ones
 * already sent.
 */

const LABELS: Record<ThinkingLevel, { label: string; hint: string }> = {
  minimal: { label: 'Minimal', hint: 'Fastest — answers straight away' },
  low: { label: 'Low', hint: 'A little thought before answering' },
  medium: { label: 'Medium', hint: 'Balanced speed and reasoning' },
  high: { label: 'High', hint: 'Slowest — thinks hardest' },
};

export function ThinkingLevelSelect({
  value,
  onChange,
  disabled = false,
}: {
  value: ThinkingLevel;
  onChange: (value: ThinkingLevel) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Derived rather than a `disabled` effect that closes it: a menu left open
  // behind a running turn would sit over a control the user can no longer
  // use, and folding that into the read keeps it a single source of truth
  // instead of two pieces of state to keep in step.
  const isOpen = open && !disabled;

  useEffect(() => {
    if (!isOpen) return;

    // Pointerdown rather than click so the menu closes on the press that
    // starts elsewhere, before that press lands on whatever is underneath.
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

  const move = (delta: number) => {
    const next = THINKING_LEVELS[
      Math.min(THINKING_LEVELS.length - 1, Math.max(0, THINKING_LEVELS.indexOf(value) + delta))
    ];
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    // Arrows step through the levels the way they would in a native select,
    // opening the list first so the change is visible rather than silent.
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      if (isOpen) move(e.key === 'ArrowDown' ? 1 : -1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Borderless on the composer's toolbar row, the way Gemini's own
          "Think" control reads: a quiet mode switch sitting next to the send
          button, not a second primary action competing with it. The
          hover/open fill is what gives it a hit area to aim at. */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-label={`Thinking level: ${LABELS[value].label}`}
        className="flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium text-text-200 transition-colors enabled:cursor-pointer enabled:hover:bg-bg-500 enabled:hover:text-text-100 disabled:cursor-not-allowed disabled:text-text-300 aria-expanded:bg-bg-500 aria-expanded:text-text-100"
      >
        <Brain className="h-[18px] w-[18px]" />
        {/* The label is the first thing to go on a narrow composer — the icon
            plus the open menu still say which level is active. */}
        <span className="hidden sm:inline">{LABELS[value].label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.ul
            id={menuId}
            role="listbox"
            aria-label="Thinking level"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.14, ease: [0.4, 0, 0.2, 1] }}
            // Anchored to the bottom of the trigger and pinned to its right
            // edge, so it opens over the transcript instead of off-screen
            // below the composer.
            className="absolute bottom-full right-0 z-20 mb-2 w-60 origin-bottom-right overflow-hidden rounded-card border border-border-subtle bg-bg-700 p-1 shadow-elevated"
          >
            {THINKING_LEVELS.map((level) => {
              const selected = level === value;
              return (
                <li key={level}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onChange(level);
                      setOpen(false);
                    }}
                    className={`flex w-full cursor-pointer items-start gap-2 rounded-[6px] px-2.5 py-2 text-left transition-colors hover:bg-bg-600 ${
                      selected ? 'bg-accent-bg' : ''
                    }`}
                  >
                    <Check
                      className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-accent ${
                        selected ? '' : 'invisible'
                      }`}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-text-100">
                        {LABELS[level].label}
                      </span>
                      <span className="block text-[11px] leading-snug text-text-300">
                        {LABELS[level].hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

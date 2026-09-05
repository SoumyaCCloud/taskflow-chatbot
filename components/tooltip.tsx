'use client';

import type { ReactNode } from 'react';

type TooltipSide = 'top' | 'bottom' | 'left' | 'right';

const SIDE_CLASSES: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2',
};

/*
 * The app's one tooltip, styled to match the rest of the UI instead of
 * whatever the OS draws for a native `title` attribute — every hover hint in
 * the app goes through this rather than `title` from here on. Pure CSS
 * (`group-hover`/`group-focus-within`, no JS state, no portal), which is what
 * keeps it cheap enough to wrap every icon-only control without a second
 * thought. `content` takes any ReactNode, not just a string — a heading plus
 * a bullet list reads far better than one long run-on sentence once there's
 * more than a single fact to show. `aria-hidden` on the bubble is deliberate:
 * the trigger's own `aria-label` (or visible text) already names it for
 * assistive tech, so this is a sighted/hover-only affordance layered on top,
 * not a second copy of it — richer content leans on that even more, since a
 * bullet list read out of context by a screen reader would be more noise
 * than help.
 */
export function Tooltip({
  content,
  side = 'top',
  className = '',
  width = 'w-max max-w-[260px]',
  hidden = false,
  children,
}: {
  content: ReactNode;
  side?: TooltipSide;
  // Escape hatch for a child that needs to fill its own parent (e.g. a
  // `w-full` field trigger) — `inline-flex` alone shrinks to fit content, so
  // a `w-full` child inside it would resolve against an auto-sized box
  // instead of the layout actually asks for. Pass an explicit width here
  // rather than letting that ambiguity resolve however the browser guesses.
  className?: string;
  // The bubble's own width classes — `w-max` up to a cap by default, so a
  // short label stays tight and only content that actually needs more room
  // (a heading plus a bullet list, say) takes it. Override per call for
  // content that wants a fixed width instead of an adaptive one.
  width?: string;
  // For a trigger that opens its own floating menu/popover: pass the menu's
  // own open state here. The mouse is still over the trigger right after the
  // click that opened it, so without this the hover tooltip and the menu it
  // just opened render on top of each other in the same corner.
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`group/tooltip relative inline-flex ${className}`}>
      {children}
      {!hidden && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute z-50 ${width} rounded-lg border border-border-subtle bg-bg-900 px-3 py-2 text-[11px] font-medium leading-snug text-text-100 opacity-0 shadow-elevated transition-opacity delay-0 duration-150 group-hover/tooltip:opacity-100 group-hover/tooltip:delay-300 group-focus-within/tooltip:opacity-100 ${SIDE_CLASSES[side]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}

'use client';

import { useUserName } from '@/components/shell-user-provider';
import { Tooltip } from '@/components/tooltip';
import { initialsFromName } from '@/lib/shell-user';

/*
 * Tinted accent rather than solid: the user bubble is already bg-accent, so a
 * solid accent circle beside it would read as one shape. accent-hover is the
 * PRD's rule for accent-colored text — raw accent lands ~3.5:1 on the ground.
 */
export function UserAvatar() {
  const name = useUserName();
  const initials = initialsFromName(name);

  // Direct visits carry no ?name; render nothing rather than a blank circle so
  // the bubble keeps its full width.
  if (!initials) return null;

  return (
    <Tooltip content={name}>
      <div
        // Decorative: the initials would be read out as nonsense, and the name is
        // already available to a pointer via the tooltip.
        aria-hidden="true"
        className="grid size-8 shrink-0 select-none place-items-center rounded-full border border-accent/30 bg-accent-bg text-[11px] font-semibold tracking-wide text-accent-hover"
      >
        {initials}
      </div>
    </Tooltip>
  );
}

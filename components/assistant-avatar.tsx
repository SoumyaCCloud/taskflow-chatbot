import { Sparkles } from 'lucide-react';

/*
 * Balances the user's initials chip on the opposite edge — without it the left
 * column has no gutter and the two sides read as different layouts. Kept on the
 * neutral card surface so the accent stays reserved for the user's own turns.
 */
export function AssistantAvatar() {
  return (
    <div
      aria-hidden="true"
      className="grid size-8 shrink-0 place-items-center rounded-full border border-border-subtle bg-bg-700 text-accent-hover shadow-card"
    >
      <Sparkles size={15} strokeWidth={1.75} />
    </div>
  );
}

import { ChevronDown, Telescope } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { State, stateName } from '@/srs/scheduler';

interface AdvancedPanelProps {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

/** Collapsible panel with the scheduler's view, for the curious. */
export function AdvancedPanel({ open, onToggle, children }: AdvancedPanelProps) {
  const contentId = useId();
  return (
    <section
      aria-label="Advanced"
      className="rounded-2xl border-2 border-dashed border-foreground/25 bg-card/60 text-xs text-muted-foreground backdrop-blur-sm"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        // Keep focus in the answer input so Enter still checks and continues.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left font-medium hover:text-foreground"
      >
        <Telescope className="size-4" />
        <span className="font-display text-sm">Advanced</span>
        <ChevronDown className={cn('ml-auto size-4 transition-transform', !open && '-rotate-90')} />
      </button>

      {open && (
        <div id={contentId} className="flex animate-rise flex-col gap-5 px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}

export function StateBadge({ state }: { state: State }) {
  const variant =
    state === State.New ? 'outline' : state === State.Review ? 'default' : 'secondary';
  return <Badge variant={variant}>{stateName(state)}</Badge>;
}

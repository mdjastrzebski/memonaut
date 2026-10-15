import { ChevronDown, Telescope } from 'lucide-react';
import { useId, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
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

/** What each scheduler term in the Advanced panels means. */
const SRS_TERMS = {
  'State': 'New → Learning → Review; forgetting a learned card sends it to Relearning.',
  'Difficulty': 'How hard the card is for you, from 1 (easy) to 10 (hard). Wrong answers raise it.',
  'Reps': 'Every review of the card, right or wrong.',
  'Lapses': 'Times the card was forgotten once learned (Again in Review); not while learning.',
  'Last review': 'When the card was reviewed before.',
  'Next review': 'When the scheduler wants to see the card again.',
} as const;

export type SrsTerm = keyof typeof SRS_TERMS;

/** A scheduler term, explained on hover. */
export function SrsTermHint({ term }: { term: SrsTerm }) {
  return (
    <Tooltip>
      <TooltipTrigger
        // Keep focus in the answer input, so Enter still checks and continues.
        onMouseDown={(event) => event.preventDefault()}
        className="cursor-help underline decoration-dotted underline-offset-2"
      >
        {term}
      </TooltipTrigger>
      <TooltipContent>{SRS_TERMS[term]}</TooltipContent>
    </Tooltip>
  );
}

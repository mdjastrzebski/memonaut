import { getProgress, type Progress } from '@/components/grades';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Session } from '@/session/session';

const PLANET_STYLES: Record<Progress, string> = {
  new: 'bg-card',
  learning: 'bg-[linear-gradient(90deg,var(--color-rocket)_50%,var(--color-card)_50%)]',
  learned: 'bg-correct',
};

interface SessionProgressProps {
  session: Session;
  currentCardId: string;
  onEnd: () => void;
}

/** One planet per card: empty when new, half-lit while learning, green once learned. */
export function SessionProgress({ session, currentCardId, onEnd }: SessionProgressProps) {
  const cards = Object.values(session.cards);
  const learned = cards.filter((card) => getProgress(card.srs.state) === 'learned').length;
  const answers = session.reviews.length;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <span className="rounded-full border-2 border-foreground bg-card px-3 py-1 font-display text-sm font-bold shadow-sticker-sm">
        {session.deck.name}
      </span>

      <div aria-hidden className="flex items-center gap-1.5">
        {cards.map((card) => (
          <span
            key={card.id}
            className={cn(
              'size-4 rounded-full border-2 border-foreground transition-all duration-500',
              PLANET_STYLES[getProgress(card.srs.state)],
              card.id === currentCardId &&
                'size-5 ring-2 ring-rocket ring-offset-2 ring-offset-background',
            )}
          />
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {learned}/{cards.length}
        </span>{' '}
        learned · {answers} {answers === 1 ? 'answer' : 'answers'}
      </p>

      <Button variant="ghost" size="sm" className="ml-auto" onClick={onEnd}>
        End session
      </Button>
    </div>
  );
}

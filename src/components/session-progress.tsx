import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getSessionProgress, type Session } from '@/session/session';

interface SessionProgressProps {
  session: Session;
  onEnd: () => void;
}

/** The deck name and one bar that fills up over the whole session. */
export function SessionProgress({ session, onEnd }: SessionProgressProps) {
  const percent = Math.round(getSessionProgress(session) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-lg font-bold">{session.deck.name}</p>
        <Button variant="ghost" size="icon" aria-label="End session" onClick={onEnd}>
          <X className="size-5" />
        </Button>
      </div>

      <div
        role="progressbar"
        aria-label="Session progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-4 overflow-hidden rounded-full border-2 border-line bg-card shadow-sticker-sm"
      >
        <div
          className="h-full rounded-full bg-correct transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

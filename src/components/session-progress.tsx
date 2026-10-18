import { Star } from 'lucide-react';

import { formatXp } from '@/lib/format';
import { getSessionProgress, type Session } from '@/session/session';
import { getSessionXp } from '@/session/xp';

interface SessionProgressProps {
  session: Session;
  /** XP earned so far, this session included. */
  xpTotal: number;
}

/**
 * One compact row: a bar that fills up over the whole session, its percent, and the session's XP,
 * which pops when it goes up, with the total below it. On phones, only the bar and the XP's number
 * fit next to the header's buttons.
 */
export function SessionProgress({ session, xpTotal }: SessionProgressProps) {
  const percent = Math.round(getSessionProgress(session) * 100);
  const xp = getSessionXp(session);

  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={`${session.deck.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-4 flex-1 overflow-hidden rounded-full border-2 border-line bg-card shadow-sticker-sm"
      >
        <div
          className="h-full rounded-full bg-correct transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <span
        aria-hidden
        className="w-11 shrink-0 text-right font-display font-bold tabular-nums max-sm:hidden"
      >
        {percent}%
      </span>

      <div className="flex shrink-0 flex-col items-center gap-0.5">
        <span
          key={xp}
          aria-label={`${formatXp(xp)} XP this session`}
          className="flex animate-pop items-center gap-1 rounded-full border-2 border-line bg-card px-2 py-0.5 font-display text-sm font-bold whitespace-nowrap tabular-nums shadow-sticker-sm"
        >
          <Star aria-hidden className="size-3.5 fill-almost" strokeWidth={2.5} />
          {formatXp(xp)}
          <span className="max-sm:hidden">XP</span>
        </span>
        <span className="text-[0.65rem] leading-none text-muted-foreground tabular-nums max-sm:sr-only">
          {formatXp(xpTotal)} total
        </span>
      </div>
    </div>
  );
}

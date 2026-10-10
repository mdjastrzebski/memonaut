import { getSessionProgress, type Session } from '@/session/session';

/** One compact row: a bar that fills up over the whole session, and its percent. */
export function SessionProgress({ session }: { session: Session }) {
  const percent = Math.round(getSessionProgress(session) * 100);

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

      <span aria-hidden className="w-11 shrink-0 text-right font-display font-bold tabular-nums">
        {percent}%
      </span>
    </div>
  );
}

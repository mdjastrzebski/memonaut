import { Zap } from 'lucide-react';
import type { CSSProperties } from 'react';

/** A faint line that drains, then fades away, while a right answer would still be rated Easy. */
export function FastBonus({ durationMs }: { durationMs: number }) {
  return (
    <div
      aria-hidden
      className="opacity-40"
      style={{ '--drain-ms': `${durationMs}ms` } as CSSProperties}
    >
      <div className="flex animate-dissolve items-center gap-1.5">
        <Zap className="size-3 text-muted-foreground" />
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full origin-left animate-drain rounded-full bg-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

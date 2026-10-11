import { Zap } from 'lucide-react';
import type { CSSProperties } from 'react';

/** A faint line that drains while a right answer would still be rated Easy. */
export function FastBonus({ durationMs }: { durationMs: number }) {
  const duration = `${durationMs}ms`;
  return (
    <div aria-hidden className="flex items-center gap-1.5 opacity-40">
      <Zap className="size-3 text-muted-foreground" />
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full origin-left animate-drain rounded-full bg-muted-foreground"
          style={{ 'animationDuration': duration, '--drain-ms': duration } as CSSProperties}
        />
      </div>
    </div>
  );
}

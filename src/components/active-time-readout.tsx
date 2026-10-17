import { useEffect, useState } from 'react';

import { formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import { IDLE_CREDIT_MS, IDLE_TIMEOUT_MS } from '@/session/active-time';

const REFRESH_MS = 100;

interface ActiveTimeReadoutProps {
  getActiveMs: () => number;
  getIdleMs: () => number | null;
}

/**
 * Dev mode's live session timer, in a corner: the active time so far and the time since the last
 * input, highlighted once past the idle credit and again once past the idle timeout.
 */
export function ActiveTimeReadout({ getActiveMs, getIdleMs }: ActiveTimeReadoutProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((tick) => tick + 1), REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  const idleMs = getIdleMs();

  return (
    <div
      aria-hidden
      className="fixed bottom-3 left-3 z-50 flex gap-3 rounded-xl border-2 border-dashed border-foreground/25 bg-card/90 px-3 py-1.5 font-mono text-xs text-muted-foreground tabular-nums"
    >
      <span>Active {formatClock(getActiveMs())}</span>
      <span
        className={cn(
          idleMs !== null &&
            idleMs > IDLE_CREDIT_MS &&
            (idleMs > IDLE_TIMEOUT_MS ? 'text-wrong-ink' : 'text-almost-ink'),
        )}
      >
        Idle {idleMs === null ? 'paused' : formatSeconds(idleMs)}
      </span>
    </div>
  );
}

/** "3:07" for minutes and seconds. */
function formatClock(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

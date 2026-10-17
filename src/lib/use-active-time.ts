import { useCallback, useEffect, useRef } from 'react';

import {
  getActiveMs,
  pauseActiveTime,
  recordActivity,
  startActiveTime,
  type ActiveTime,
} from '@/session/active-time';

const ACTIVITY_EVENTS = ['keydown', 'pointerdown'] as const;

/**
 * Tracks active time while `running`: starts afresh each time it turns on, stops when the learner
 * is idle or the page is hidden, and goes on with the next key press or tap. Returns a getter
 * for the active time so far; kept in a ref, since every key press updates it.
 */
export function useActiveTime(running: boolean): () => number {
  const time = useRef<ActiveTime>({ accumulatedMs: 0, lastActivityAt: null });

  useEffect(() => {
    if (!running) return;
    time.current = startActiveTime(Date.now());

    const handleActivity = () => {
      time.current = recordActivity(time.current, Date.now());
    };
    const handleVisibilityChange = () => {
      if (document.hidden) time.current = pauseActiveTime(time.current, Date.now());
    };

    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, handleActivity, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      time.current = pauseActiveTime(time.current, Date.now());
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, handleActivity, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [running]);

  return useCallback(() => getActiveMs(time.current, Date.now()), []);
}

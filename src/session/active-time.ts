/** After this long without input the learner counts as away, and the time stops. */
export const IDLE_TIMEOUT_MS = 30_000;

/**
 * Time spent actively practising. It stops `IDLE_TIMEOUT_MS` after the last input, or when paused
 * (e.g. the page is hidden), and goes on with the next input. Times are epoch milliseconds.
 */
export interface ActiveTime {
  /** Active time of the stretches before `activeSince`. */
  accumulatedMs: number;
  /** When the current active stretch began, or null while paused. */
  activeSince: number | null;
  lastActivityAt: number;
}

export function startActiveTime(now: number): ActiveTime {
  return { accumulatedMs: 0, activeSince: now, lastActivityAt: now };
}

/**
 * The time is capped at `IDLE_TIMEOUT_MS` after the last input, so an idle stretch counts the same
 * however late it's noticed, e.g. after the computer slept.
 */
export function getActiveMs(time: ActiveTime, now: number): number {
  if (time.activeSince === null) return time.accumulatedMs;
  const end = Math.min(now, time.lastActivityAt + IDLE_TIMEOUT_MS);
  return time.accumulatedMs + Math.max(0, end - time.activeSince);
}

/** Input from the learner: keeps the time going, or starts a new stretch after a pause. */
export function recordActivity(time: ActiveTime, now: number): ActiveTime {
  if (time.activeSince !== null && now - time.lastActivityAt <= IDLE_TIMEOUT_MS) {
    return { ...time, lastActivityAt: now };
  }
  return { ...pauseActiveTime(time, now), activeSince: now, lastActivityAt: now };
}

export function pauseActiveTime(time: ActiveTime, now: number): ActiveTime {
  if (time.activeSince === null) return time;
  return { ...time, accumulatedMs: getActiveMs(time, now), activeSince: null };
}

/** After this long without input the learner counts as away, and the time stops. */
export const IDLE_TIMEOUT_MS = 20_000;
/** How much of the time after the last input counts until the next input shows the learner stayed. */
export const IDLE_CREDIT_MS = 10_000;

/**
 * Time spent actively practising. The time between two inputs counts in full when they're at most
 * `IDLE_TIMEOUT_MS` apart; otherwise, or when paused (e.g. the page is hidden), only
 * `IDLE_CREDIT_MS` after the last input counts. The next input goes on. Times are epoch milliseconds.
 */
export interface ActiveTime {
  /** Active time up to `lastActivityAt`, or all of it while paused. */
  accumulatedMs: number;
  /** When the last input of the current stretch was, or null while paused. */
  lastActivityAt: number | null;
}

export function startActiveTime(now: number): ActiveTime {
  return { accumulatedMs: 0, lastActivityAt: now };
}

/**
 * The time since the last input counts up to `IDLE_CREDIT_MS` until the next input, so an idle
 * stretch counts the same however late it's noticed, e.g. after the computer slept.
 */
export function getActiveMs(time: ActiveTime, now: number): number {
  if (time.lastActivityAt === null) return time.accumulatedMs;
  return time.accumulatedMs + Math.min(Math.max(0, now - time.lastActivityAt), IDLE_CREDIT_MS);
}

/** Input from the learner: counts the time since the last one in full, unless they were away. */
export function recordActivity(time: ActiveTime, now: number): ActiveTime {
  if (time.lastActivityAt !== null && now - time.lastActivityAt <= IDLE_TIMEOUT_MS) {
    return {
      accumulatedMs: time.accumulatedMs + Math.max(0, now - time.lastActivityAt),
      lastActivityAt: now,
    };
  }
  return { accumulatedMs: getActiveMs(time, now), lastActivityAt: now };
}

export function pauseActiveTime(time: ActiveTime, now: number): ActiveTime {
  if (time.lastActivityAt === null) return time;
  return { accumulatedMs: getActiveMs(time, now), lastActivityAt: null };
}

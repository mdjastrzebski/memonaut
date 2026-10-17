const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Compact duration, e.g. "45s", "10m", "3h", "8d", "1.2y". */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < MINUTE) return `${Math.round(abs / 1000)}s`;
  if (abs < HOUR) return `${Math.round(abs / MINUTE)}m`;
  if (abs < DAY) return `${Math.round(abs / HOUR)}h`;
  if (abs < 365 * DAY) return `${Math.round(abs / DAY)}d`;
  return `${(abs / (365 * DAY)).toFixed(1)}y`;
}

/** Seconds with one decimal, e.g. "2.5s". */
export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** "in 10m", "now" or "5m ago". */
export function formatRelative(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  if (Math.abs(diff) < 1000) return 'now';
  return diff > 0 ? `in ${formatDuration(diff)}` : `${formatDuration(diff)} ago`;
}

export function formatNumber(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/** Whole minutes for time spent, e.g. "0 min", "25 min" or "1 h 5 min". */
export function formatMinutes(ms: number): string {
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest ? `${Math.floor(minutes / 60)} h ${rest} min` : `${minutes / 60} h`;
}

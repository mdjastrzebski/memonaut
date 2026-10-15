import { DEFAULT_POINTS_PER_MINUTE } from '@/session/effort';

/**
 * The learner's pace in each Subject, in effort points per minute, kept in localStorage:
 * `{ "german": 7.4 }`. Measured after each session, so the next one plans how much fits in the
 * time picked.
 */
const STORAGE_KEY = 'memonaut:pace';

/** The pace in a Subject, or the default before any session was timed. */
export function loadPace(subjectId: string): number {
  const pace = read()[subjectId];
  return typeof pace === 'number' && pace > 0 ? pace : DEFAULT_POINTS_PER_MINUTE;
}

export function savePace(subjectId: string, pointsPerMinute: number) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...read(), [subjectId]: Math.round(pointsPerMinute * 100) / 100 }),
    );
  } catch {
    // Storage can be full or blocked, e.g. in private mode; the pace is then only kept until reload.
  }
}

function read(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

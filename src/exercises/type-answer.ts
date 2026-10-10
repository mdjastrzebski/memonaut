import { Rating, type Grade } from '@/srs/scheduler';

/** An exact answer typed within `FAST_BASE_MS + FAST_PER_CHAR_MS × answer length` is rated Easy. */
const FAST_BASE_MS = 2500;
const FAST_PER_CHAR_MS = 500;

/** A forgiven mistake in an almost-correct answer. */
export type AnswerIssue = 'case' | 'diacritics' | 'typo';

export interface AnswerResult {
  grade: Grade;
  /** Every mistake forgiven to rate the answer Hard. */
  issues: AnswerIssue[];
  elapsedMs: number;
}

const TRANSLITERATIONS: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
  Ä: 'Ae',
  Ö: 'Oe',
  Ü: 'Ue',
  ẞ: 'SS',
};

export function getFastLimitMs(answer: string): number {
  return FAST_BASE_MS + FAST_PER_CHAR_MS * answer.length;
}

/**
 * Rates a typed answer automatically:
 * - Easy: exact and typed within the fast limit
 * - Good: exact
 * - Hard: exact after forgiving any combination of wrong capitalization, missing umlauts or ß
 *   ("Funf", "fuenf") and one letter off
 * - Again: anything else
 *
 * Forgiven mistakes accumulate: the answer is compared with all of them forgiven at once, and
 * each mistake is reported if it still makes a difference when the others are forgiven.
 */
export function gradeAnswer(expected: string, input: string, elapsedMs: number): AnswerResult {
  const result = (grade: Grade, issues: AnswerIssue[] = []) => ({ grade, issues, elapsedMs });

  const target = normalizeSpacing(expected);
  const given = normalizeSpacing(input);
  if (given === target) {
    return result(elapsedMs <= getFastLimitMs(expected) ? Rating.Easy : Rating.Good);
  }

  const lower = (value: string) => value.toLowerCase();
  const remaining = distanceIgnoringDiacritics(lower(given), lower(target));
  if (remaining > 1) {
    return result(Rating.Again);
  }

  const issues: AnswerIssue[] = [];
  if (distanceIgnoringDiacritics(given, target) > remaining) issues.push('case');
  if (levenshtein(lower(given), lower(target)) > remaining) issues.push('diacritics');
  if (remaining === 1) issues.push('typo');
  return result(Rating.Hard, issues);
}

function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/** Edit distance when "u", "ue" and "ü" (and "ss" and "ß") count as the same. */
function distanceIgnoringDiacritics(a: string, b: string): number {
  return Math.min(
    levenshtein(stripDiacritics(a), stripDiacritics(b)),
    levenshtein(transliterate(a), transliterate(b)),
  );
}

/** "Fünf" → "Funf", "Straße" → "Strasse". */
function stripDiacritics(value: string): string {
  return value.replace(/ß/g, 'ss').replace(/ẞ/g, 'SS').normalize('NFD').replace(/\p{M}/gu, '');
}

/** "Fünf" → "Fuenf". */
function transliterate(value: string): string {
  return value.replace(/[äöüßÄÖÜẞ]/g, (char) => TRANSLITERATIONS[char]);
}

function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

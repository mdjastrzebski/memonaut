import { Rating, type Grade } from '@/srs/scheduler';

/**
 * An exact answer typed within `FAST_BASE_MS + FAST_PER_CHAR_MS × answer length` is rated Easy,
 * plus `FAST_PER_SPECIAL_CHAR_MS` for each special character, which is slower to type.
 */
const FAST_BASE_MS = 4000;
const FAST_PER_CHAR_MS = 1000;
const FAST_PER_SPECIAL_CHAR_MS = 2500;

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
  const specialChars = answer.match(/\P{ASCII}/gu)?.length ?? 0;
  return FAST_BASE_MS + FAST_PER_CHAR_MS * answer.length + FAST_PER_SPECIAL_CHAR_MS * specialChars;
}

interface GradeOptions {
  /** Forgive only wrong capitalization, e.g. in spelling practice. */
  strict?: boolean;
}

/**
 * Rates a typed answer automatically, after tidying up both answers with `normalizeAnswer`:
 * - Easy: exact and typed within the fast limit
 * - Good: exact
 * - Hard: exact after forgiving any combination of wrong capitalization, missing umlauts or ß
 *   ("Funf", "fuenf") and one letter off; only wrong capitalization when `strict`; nothing when
 *   the answer is a number, as one digit off is a wrong result, not a typo
 * - Again: anything else
 *
 * Forgiven mistakes accumulate: the answer is compared with all of them forgiven at once, and
 * each mistake is reported if it still makes a difference when the others are forgiven.
 */
export function gradeAnswer(
  expected: string,
  input: string,
  elapsedMs: number,
  { strict = false }: GradeOptions = {},
): AnswerResult {
  const result = (grade: Grade, issues: AnswerIssue[] = []) => ({ grade, issues, elapsedMs });

  const target = normalizeAnswer(expected);
  const given = normalizeAnswer(input);
  if (given === target) {
    return result(elapsedMs <= getFastLimitMs(expected) ? Rating.Easy : Rating.Good);
  }

  if (isNumber(target)) {
    return result(Rating.Again);
  }

  const lower = (value: string) => value.toLowerCase();
  if (strict) {
    return lower(given) === lower(target) ? result(Rating.Hard, ['case']) : result(Rating.Again);
  }

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

/**
 * Rates a typed answer against each of several right ones, e.g. "hundert" or "einhundert", and
 * keeps the best rating, the earliest answer on a tie. Returns the answer it was rated against.
 */
export function gradeAnyAnswer(
  answers: string[],
  input: string,
  elapsedMs: number,
  options?: GradeOptions,
): { answer: string; result: AnswerResult } {
  let best: { answer: string; result: AnswerResult } | undefined;
  for (const answer of answers) {
    const result = gradeAnswer(answer, input, elapsedMs, options);
    if (!best || result.grade > best.result.grade) best = { answer, result };
  }
  return best!;
}

/** "9", "-3", "2,5" or "1000". */
function isNumber(value: string): boolean {
  return /^-?\d+([.,]\d+)?$/.test(value);
}

export function normalizeSpacing(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Tidies up differences that aren't mistakes, so they don't count against the answer: spacing,
 * curly quotes from phone keyboards, a missing or extra ".", "?" or "!" at the end and Spanish
 * "¿" or "¡" at the start. "Wie geht’s dir ?" → "Wie geht's dir", "¿Qué tal?" → "Qué tal".
 */
export function normalizeAnswer(value: string): string {
  return splitOuterPunctuation(normalizePunctuation(value))[1];
}

/** Straightens curly quotes and fixes spacing around punctuation: "noch einmal ,bitte" → "noch einmal, bitte". */
export function normalizePunctuation(value: string): string {
  return normalizeSpacing(value.replace(/[‘’‚‛ʼ`´]/g, "'").replace(/[“”„‟]/g, '"'))
    .replace(/ (?=[,.!?;:])/g, '')
    .replace(/,(?=\p{L})/gu, ', ');
}

/** "¿Qué tal?" → ["¿", "Qué tal", "?"]. */
export function splitOuterPunctuation(value: string): [start: string, text: string, end: string] {
  const [, start, text, end] = /^([¿¡]*)\s*(.*?)\s*([.?!]*)$/su.exec(value)!;
  return [start, text, end];
}

/** Edit distance when "u", "ue" and "ü" (and "ss" and "ß") count as the same. */
function distanceIgnoringDiacritics(a: string, b: string): number {
  return Math.min(
    levenshtein(stripDiacritics(a), stripDiacritics(b)),
    levenshtein(transliterate(a), transliterate(b)),
  );
}

/** "Fünf" → "Funf", "Straße" → "Strasse". */
export function stripDiacritics(value: string): string {
  return value.replace(/ß/g, 'ss').replace(/ẞ/g, 'SS').normalize('NFD').replace(/\p{M}/gu, '');
}

/** "Fünf" → "Fuenf". */
export function transliterate(value: string): string {
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

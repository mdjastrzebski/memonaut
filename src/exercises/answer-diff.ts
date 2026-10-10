import {
  normalizePunctuation,
  splitOuterPunctuation,
  stripDiacritics,
  transliterate,
} from '@/exercises/type-answer';

/**
 * How a piece of the typed answer lines up with the expected answer:
 * - `match`: the same letter
 * - `minor`: the right letter with wrong capitalization or a missing umlaut, e.g. "u" or "ue" for "ü"
 * - `wrong`: a different letter
 * - `extra`: a letter that shouldn't be there
 * - `missing`: a letter that was left out
 */
export type DiffKind = 'match' | 'minor' | 'wrong' | 'extra' | 'missing';

export interface DiffPart {
  kind: DiffKind;
  /** What the learner typed here; empty for `missing`. */
  typed: string;
  /** What the answer has here; empty for `extra`. */
  expected: string;
}

const COST: Record<DiffKind, number> = { match: 0, minor: 1, wrong: 2, extra: 2, missing: 2 };

/**
 * Lines up a typed answer with the expected one letter by letter, or returns `undefined` when they
 * differ too much for a letter diff to help, e.g. a different word. Wrong capitalization and
 * missing umlauts don't count towards that, so "FUENF" still diffs against "fünf".
 *
 * Like grading, it forgives curly quotes, the "?", "." or "!" at the end and the "¿" or "¡" at the
 * start: those show as a match, even when only one side has them.
 */
export function diffAnswer(expected: string, input: string): DiffPart[] | undefined {
  const [expectedStart, expectedText, expectedEnd] = splitOuterPunctuation(
    normalizePunctuation(expected),
  );
  const [typedStart, typedText, typedEnd] = splitOuterPunctuation(normalizePunctuation(input));
  const parts = alignLetters(expectedText, typedText);
  const mistakes = parts.filter((part) => COST[part.kind] > COST.minor).length;
  if (mistakes > getMaxMistakes(expectedText)) return undefined;
  if (expectedStart || typedStart)
    parts.unshift({ kind: 'match', typed: typedStart, expected: expectedStart });
  if (expectedEnd || typedEnd)
    parts.push({ kind: 'match', typed: typedEnd, expected: expectedEnd });
  return parts;
}

/** About one mistake per three letters, so a short word allows one. */
function getMaxMistakes(expected: string): number {
  return Math.max(1, Math.floor(expected.length / 3));
}

/** Weighted edit distance alignment, where near-misses are cheaper than wrong letters. */
function alignLetters(expected: string, typed: string): DiffPart[] {
  const steps = (i: number, j: number) => {
    // Extra and missing letters come first, so on a tie they go last: "achtt" has an extra
    // second "t", not first.
    const options: { part: DiffPart; from: [number, number] }[] = [];
    if (i > 0) {
      options.push({
        part: { kind: 'extra', typed: typed[i - 1], expected: '' },
        from: [i - 1, j],
      });
    }
    if (j > 0) {
      options.push({
        part: { kind: 'missing', typed: '', expected: expected[j - 1] },
        from: [i, j - 1],
      });
    }
    if (i > 0 && j > 0) {
      const t = typed[i - 1];
      const e = expected[j - 1];
      options.push({
        part: { kind: compareLetters(t, e), typed: t, expected: e },
        from: [i - 1, j - 1],
      });
    }
    // "ue" typed for "ü", "ss" for "ß".
    if (i > 1 && j > 0) {
      const t = typed.slice(i - 2, i);
      const e = expected[j - 1];
      if (transliterate(e) !== e && t.toLowerCase() === transliterate(e).toLowerCase()) {
        options.push({ part: { kind: 'minor', typed: t, expected: e }, from: [i - 2, j - 1] });
      }
    }
    return options;
  };

  // cost[i][j]: cheapest alignment of the first i typed letters with the first j expected ones.
  const cost = Array.from({ length: typed.length + 1 }, () =>
    new Array<number>(expected.length + 1).fill(Infinity),
  );
  cost[0][0] = 0;
  for (let i = 0; i <= typed.length; i++) {
    for (let j = 0; j <= expected.length; j++) {
      for (const { part, from } of steps(i, j)) {
        cost[i][j] = Math.min(cost[i][j], cost[from[0]][from[1]] + COST[part.kind]);
      }
    }
  }

  const parts: DiffPart[] = [];
  let i = typed.length;
  let j = expected.length;
  while (i > 0 || j > 0) {
    const step = steps(i, j).find(
      ({ part, from }) => cost[from[0]][from[1]] + COST[part.kind] === cost[i][j],
    )!;
    parts.unshift(step.part);
    [i, j] = step.from;
  }
  return parts;
}

function compareLetters(typed: string, expected: string): DiffKind {
  if (typed === expected) return 'match';
  const fold = (letter: string) => stripDiacritics(letter.toLowerCase());
  return fold(typed) === fold(expected) ? 'minor' : 'wrong';
}

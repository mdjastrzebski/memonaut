import type { LanguageConcept } from '@/domain/types';
import { shuffle } from '@/lib/shuffle';
import { Rating } from '@/srs/scheduler';

import { normalizeAnswer, type AnswerResult } from './type-answer';

/** Which word of a Concept is offered as an option. */
export type ChoiceSide = 'local' | 'foreign';

/** How many options are offered, the right one included, when there are enough words. */
export const CHOICE_COUNT = 4;

/**
 * A right pick within this time is rated Easy: the word was known at once, not found by ruling the
 * other options out.
 */
export const FAST_CHOICE_MS = 3000;

interface PickChoicesOptions {
  side: ChoiceSide;
  /** Other Concepts of the Deck, which make the best wrong options: same topic and level. */
  deckConcepts: LanguageConcept[];
  /** Other Concepts of the Subject, used only when the Deck has too few. */
  subjectConcepts: LanguageConcept[];
  count?: number;
  random?: () => number;
}

/** Prefixes of a group and of each wider one it's in, narrowest first: "number/small/", "number/". */
function getGroupPrefixes(group: string | undefined): string[] {
  const parts = group?.split('/') ?? [];
  return parts.map((_, index) => `${parts.slice(0, parts.length - index).join('/')}/`);
}

/**
 * The options for a multiple-choice exercise, in random order: the answer's word on `side`, and
 * the same word of other Concepts as wrong options. Those of the answer's group come first, e.g.
 * other days for "Monday", then those of each wider group, e.g. any "number/…" for one in
 * "number/small", then the rest; each from the Deck first, then the Subject.
 *
 * A Concept sharing the answer's local or foreign word is left out, as it would be right too, e.g.
 * "big" and "large" both for "duży".
 */
export function pickChoices(
  answer: LanguageConcept,
  {
    side,
    deckConcepts,
    subjectConcepts,
    count = CHOICE_COUNT,
    random = Math.random,
  }: PickChoicesOptions,
): string[] {
  const key = (value = '') => normalizeAnswer(value).toLowerCase();
  const taken = new Set([key(answer[side])]);
  const isWrong = (concept: LanguageConcept) =>
    concept[side] !== undefined &&
    key(concept.local) !== key(answer.local) &&
    key(concept.foreign) !== key(answer.foreign);

  const inGroup = (prefix: string) => (concept: LanguageConcept) =>
    `${concept.group ?? ''}/`.startsWith(prefix);
  const candidates = [
    ...getGroupPrefixes(answer.group).flatMap((prefix) => [
      deckConcepts.filter(inGroup(prefix)),
      subjectConcepts.filter(inGroup(prefix)),
    ]),
    deckConcepts,
    subjectConcepts,
  ].flatMap((concepts) => shuffle(concepts, random));

  const options = [answer[side]!];
  for (const concept of candidates) {
    if (options.length >= count) break;
    if (!isWrong(concept) || taken.has(key(concept[side]))) continue;
    taken.add(key(concept[side]));
    options.push(concept[side]!);
  }
  return shuffle(options, random);
}

/** Rates a picked option: Easy if right within `FAST_CHOICE_MS`, Good if right later, else Again. */
export function gradeChoice(answer: string, picked: string, elapsedMs: number): AnswerResult {
  const grade =
    picked !== answer ? Rating.Again : elapsedMs <= FAST_CHOICE_MS ? Rating.Easy : Rating.Good;
  return { grade, issues: [], elapsedMs };
}

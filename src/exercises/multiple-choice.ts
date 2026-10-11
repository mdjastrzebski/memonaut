import type { Concept, ExerciseType } from '@/domain/types';
import { shuffle } from '@/lib/shuffle';
import { Rating } from '@/srs/scheduler';

import { normalizeAnswer, type AnswerResult } from './type-answer';

/** Which word of a Concept is offered as an option. */
export type ChoiceSide = 'local' | 'foreign';

/** The multiple-choice Exercise Types and the word picked in each. */
const CHOICE_SIDES: Partial<Record<ExerciseType, ChoiceSide>> = {
  'recognition-choice': 'local',
  'translation-choice': 'foreign',
};

/** The word picked in a multiple-choice Exercise Type; none for a typed one. */
export function getChoiceSide(exerciseType: ExerciseType): ChoiceSide | undefined {
  return CHOICE_SIDES[exerciseType];
}

/** How many options are offered, the right one included, when there are enough words. */
export const CHOICE_COUNT = 4;

interface PickChoicesOptions {
  side: ChoiceSide;
  /** Other Concepts of the Deck, which make the best wrong options: same topic and level. */
  deckConcepts: Concept[];
  /** Other Concepts of the Subject, used only when the Deck has too few. */
  subjectConcepts: Concept[];
  count?: number;
  random?: () => number;
}

/**
 * The options for a multiple-choice exercise, in random order: the answer's word on `side`, and
 * the same word of other Concepts as wrong options, from the Deck first, then the Subject.
 *
 * A Concept sharing the answer's local or foreign word is left out, as it would be right too, e.g.
 * "big" and "large" both for "duży".
 */
export function pickChoices(
  answer: Concept,
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
  const isWrong = (concept: Concept) =>
    concept[side] !== undefined &&
    key(concept.local) !== key(answer.local) &&
    key(concept.foreign) !== key(answer.foreign);

  const options = [answer[side]!];
  for (const concept of [...shuffle(deckConcepts, random), ...shuffle(subjectConcepts, random)]) {
    if (options.length >= count) break;
    if (!isWrong(concept) || taken.has(key(concept[side]))) continue;
    taken.add(key(concept[side]));
    options.push(concept[side]!);
  }
  return shuffle(options, random);
}

/**
 * Rates a picked option: Good if right, else Again. Never Easy, however fast, since picking the
 * word is easier than recalling it.
 */
export function gradeChoice(answer: string, picked: string, elapsedMs: number): AnswerResult {
  return { grade: picked === answer ? Rating.Good : Rating.Again, issues: [], elapsedMs };
}

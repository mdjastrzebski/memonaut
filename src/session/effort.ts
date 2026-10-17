import type { Card, ExerciseType, Review } from '@/domain/types';
import { getRetrievability, State, type FsrsCard } from '@/srs/scheduler';

/**
 * Effort points of one answer to each Exercise Type, before the Card's difficulty. One point is
 * about one quick multiple-choice answer; typing an answer takes about twice as long or more.
 */
export const EXERCISE_EFFORT: Record<ExerciseType, number> = {
  'recognition-choice': 1,
  'dictation': 2,
  'translation-choice': 1,
  // As quick as other multiple choice to answer: three short options always in the same place and
  // nothing read aloud first, but recalling a gender takes thought, and its result has rules to read.
  'article-choice-de': 1,
  // Typed like plural form, but only a short word: the sentence and its meaning are on screen.
  'cloze': 1.5,
  'translation': 2.5,
  // Typed like translation, but the word is on screen and only its plural is recalled.
  'plural-form': 2,
  'translation-plural': 2.5,
  'question-choice': 1.5,
  'question-type': 2.5,
};

/**
 * Effort points of a new word's intro: reading it and its meaning while it's read aloud, about half
 * as long as a quick multiple-choice answer.
 */
export const INTRO_EFFORT = 0.5;

/**
 * How many points a learner gets through per minute before any session was timed. Sessions
 * planned at 8 took a child about 1.9 times as long as picked (10 minutes for 5, 18 for 10).
 */
export const DEFAULT_POINTS_PER_MINUTE = 4.2;

/** Sessions shorter than this, in active time, are too short to tell the learner's pace. */
const MIN_PACE_MS = 60_000;
/** A session of this many active minutes or more moves the pace halfway to what it measured. */
const FULL_WEIGHT_MINUTES = 10;
const PACE_LIMITS = [2, 40] as const;

/**
 * How much harder a Card is than an average one, from its FSRS difficulty (1–10): from 0.8 for
 * the easiest to 1.25 for the hardest. A new Card counts as average.
 */
export function getDifficultyFactor(srs: Pick<FsrsCard, 'state' | 'difficulty'>): number {
  if (srs.state === State.New) return 1;
  return 1 + (srs.difficulty - 5) / 20;
}

/**
 * How many times a Card is expected to be answered in one session. A new one goes through a
 * learning step (10m) before it graduates, a learning one has a step left, and a due one comes
 * back for a relearning step when it's forgotten, which `retrievability` (0–1) tells the chance of.
 */
export function getExpectedAnswers(state: State, retrievability: number): number {
  switch (state) {
    case State.New:
      return 2;
    case State.Learning:
    case State.Relearning:
      return 1.5;
    case State.Review:
      return 2 - retrievability;
  }
}

/** The effort points a Card is expected to take in a session started at `now`. */
export function getCardEffort(card: Card, now: Date): number {
  return (
    EXERCISE_EFFORT[card.exerciseType] *
    getDifficultyFactor(card.srs) *
    getExpectedAnswers(card.srs.state, getRetrievability(card.srs, now))
  );
}

/** The effort points one answer took, by its Exercise Type and the Card's difficulty before it. */
export function getReviewEffort(review: Review, exerciseType: ExerciseType): number {
  return getAnswerEffort(exerciseType, review.log);
}

/** The effort points of one answer to a Card in the given memory state. */
export function getAnswerEffort(
  exerciseType: ExerciseType,
  srs: Pick<FsrsCard, 'state' | 'difficulty'>,
): number {
  return EXERCISE_EFFORT[exerciseType] * getDifficultyFactor(srs);
}

/**
 * The learner's pace after a session: moved toward the points per minute it measured, more so the
 * longer it was. Too short a session keeps the pace as it was.
 */
export function updatePace(pointsPerMinute: number, effortDone: number, activeMs: number): number {
  if (activeMs < MIN_PACE_MS || effortDone <= 0) return pointsPerMinute;
  const minutes = activeMs / 60_000;
  const measured = effortDone / minutes;
  const weight = Math.min(minutes / FULL_WEIGHT_MINUTES, 1) / 2;
  const [min, max] = PACE_LIMITS;
  return Math.min(Math.max(pointsPerMinute + (measured - pointsPerMinute) * weight, min), max);
}

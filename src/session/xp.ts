import type { ExerciseType } from '@/domain/types';
import { EXERCISE_EFFORT } from '@/session/effort';
import type { Session } from '@/session/session';
import { Rating, type Grade } from '@/srs/scheduler';

/**
 * XP of one answer: its Exercise Type's effort points when it's right, twice as many when it's
 * fast, and none when it's almost right or missed. It goes by the rating the answer was scheduled
 * with, so a fast answer that counts as Good, e.g. right after a word's intro, earns no bonus.
 */
export function getAnswerXp(exerciseType: ExerciseType, rating: Grade): number {
  if (rating === Rating.Easy) return 2 * EXERCISE_EFFORT[exerciseType];
  if (rating === Rating.Good) return EXERCISE_EFFORT[exerciseType];
  return 0;
}

/** XP of all the answers given in a session so far. */
export function getSessionXp(session: Session): number {
  return session.reviews.reduce(
    (total, review) =>
      total + getAnswerXp(session.cards[review.cardId].exerciseType, review.rating),
    0,
  );
}

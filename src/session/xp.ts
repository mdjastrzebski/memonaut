import type { ExerciseType } from '@/domain/types';
import { EXERCISE_EFFORT } from '@/session/effort';
import type { Session } from '@/session/session';
import { Rating, type Grade } from '@/srs/scheduler';

/**
 * XP of one answer: its Exercise Type's effort points when it's right, twice as many when it's
 * fast, and none when it's almost right or missed.
 */
export function getAnswerXp(exerciseType: ExerciseType, rating: Grade): number {
  if (rating === Rating.Easy) return 2 * EXERCISE_EFFORT[exerciseType];
  if (rating === Rating.Good) return EXERCISE_EFFORT[exerciseType];
  return 0;
}

/**
 * XP of all the answers given in a session so far, by the rating each earned: a fast answer right
 * after a word's intro earns double too, though it's scheduled as Good, so the word comes back.
 */
export function getSessionXp(session: Session): number {
  return session.reviews.reduce(
    (total, review) =>
      total + getAnswerXp(session.cards[review.cardId].exerciseType, review.earnedRating),
    0,
  );
}

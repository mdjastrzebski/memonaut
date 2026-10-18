import { useState } from 'react';

import type { Card } from '@/domain/types';
import type { AnswerResult } from '@/exercises/type-answer';
import { playCorrect, playFast } from '@/lib/sounds';
import { stopHint } from '@/lib/speech';
import { getScheduledGrade, type Session, type SubmitReviewInput } from '@/session/session';
import { Rating } from '@/srs/scheduler';

/** The learner's answer to an exercise, rated when given. */
export interface Answered {
  /** What the learner typed or picked. */
  input: string;
  result: AnswerResult;
  at: Date;
}

/**
 * When the exercise appeared and the learner's answer once given. `check` rates an answer by how
 * long it took and cheers a right one, more so a fast one that earns double XP; `submit` reports it
 * as the Card's review.
 */
export function useAnswer(
  session: Session,
  card: Card,
  onReview: (review: SubmitReviewInput) => void,
) {
  const [shownAt] = useState(() => new Date());
  const [answered, setAnswered] = useState<Answered | null>(null);

  const check = (input: string, grade: (elapsedMs: number) => AnswerResult) => {
    const at = new Date();
    const result = grade(at.getTime() - shownAt.getTime());
    setAnswered({ input, result, at });
    // Once answered, a hint still to come would only talk over the feedback or the next word.
    stopHint();
    const scheduled = getScheduledGrade(session, card, result.grade);
    if (scheduled === Rating.Easy) playFast();
    else if (scheduled === Rating.Good) playCorrect();
  };

  const submit = () => {
    if (!answered) return;
    const { input, result, at } = answered;
    onReview({
      input,
      elapsedMs: result.elapsedMs,
      rating: result.grade,
      issues: result.issues,
      now: at,
    });
  };

  return { answered, check, submit, now: answered?.at ?? shownAt };
}

import { useState } from 'react';

import type { AnswerResult } from '@/exercises/type-answer';
import { playCorrect } from '@/lib/sounds';
import { stopHint } from '@/lib/speech';
import type { SubmitReviewInput } from '@/session/session';
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
 * long it took and cheers a right one; `submit` reports it as the Card's review.
 */
export function useAnswer(onReview: (review: SubmitReviewInput) => void) {
  const [shownAt] = useState(() => new Date());
  const [answered, setAnswered] = useState<Answered | null>(null);

  const check = (input: string, grade: (elapsedMs: number) => AnswerResult) => {
    const at = new Date();
    const result = grade(at.getTime() - shownAt.getTime());
    setAnswered({ input, result, at });
    // Once answered, a hint still to come would only talk over the feedback or the next word.
    stopHint();
    if (result.grade === Rating.Good || result.grade === Rating.Easy) playCorrect();
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

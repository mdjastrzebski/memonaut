import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Burst } from '@/components/burst';
import { GRADE_ICONS, GRADE_STYLES } from '@/components/grades';
import { CardStats, RatingPreview, SrsDetails, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import type { Card, Concept, Subject } from '@/domain/types';
import type { AnswerResult } from '@/exercises/type-answer';
import { formatDuration, formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import { LEARN_AHEAD_MS, type Session, type SubmitReviewInput } from '@/session/session';
import { previewReview, Rating, ratingName, type Grade } from '@/srs/scheduler';

/** What every Exercise Type's component gets: the Card to practise and the screen's settings. */
export interface ExerciseProps {
  session: Session;
  card: Card;
  concept: Concept;
  onReview: (review: SubmitReviewInput) => void;
  /** Its language is used to read words aloud and its special characters are offered on screen. */
  subject: Subject;
  /** Every Concept of the Subject, for wrong options in multiple choice. */
  subjectConcepts: Concept[];
  showSpecialCharacters: boolean;
  onToggleSpecialCharacters: () => void;
  showSrsDetails: boolean;
  onToggleSrsDetails: () => void;
}

interface ExerciseCardProps {
  /** Extra context drawn large in the corner, e.g. "3". */
  hint?: string;
  children: ReactNode;
}

/** The card an exercise is shown on. */
export function ExerciseCard({ hint, children }: ExerciseCardProps) {
  return (
    <section
      aria-label="Exercise"
      className="relative animate-card-in overflow-hidden rounded-[2rem] border-2 border-line bg-card px-6 pt-6 pb-6 shadow-sticker-lg sm:px-10 sm:pt-8 sm:pb-8"
    >
      {hint && (
        <span className="pointer-events-none absolute -top-4 right-4 rotate-6 font-display text-[8.5rem] leading-none font-black text-rocket/25 select-none sm:right-8 sm:text-[11rem]">
          {hint}
        </span>
      )}
      {children}
    </section>
  );
}

/** The word to answer, shown big at the top of the exercise. */
export function PromptWord({ children }: { children: ReactNode }) {
  return (
    <h2 className="min-w-0 font-display text-4xl font-extrabold tracking-tight break-words sm:text-5xl">
      {children}
    </h2>
  );
}

interface FeedbackPanelProps {
  grade: Grade;
  children: ReactNode;
}

/** The result as an icon, celebrated when right, next to what to remember about the word. */
export function FeedbackPanel({ grade, children }: FeedbackPanelProps) {
  const style = GRADE_STYLES[grade];
  const Icon = GRADE_ICONS[grade];
  const right = grade === Rating.Good || grade === Rating.Easy;

  return (
    <div
      role="status"
      className={cn(
        'flex animate-rise items-center gap-4 rounded-2xl border-2 border-line p-4',
        style.tint,
      )}
    >
      <span className="relative shrink-0 self-start">
        <span
          className={cn(
            'grid size-11 animate-pop place-items-center rounded-full border-2 border-line',
            style.fill,
          )}
        >
          <Icon className="size-5" strokeWidth={3} />
          <span className="sr-only">{ratingName(grade)}</span>
        </span>
        {right && <Burst />}
      </span>
      {children}
    </div>
  );
}

interface ContinueButtonProps extends ComponentProps<typeof Button> {
  /** Off when the hint is shown elsewhere, e.g. below a row of buttons. */
  showEnterHint?: boolean;
}

/** Moves on to the next exercise once the feedback is read. */
export function ContinueButton({ showEnterHint = true, className, ...props }: ContinueButtonProps) {
  return (
    <>
      <Button variant="cta" className={cn('h-13 rounded-2xl text-lg', className)} {...props}>
        Continue <ArrowRight className="size-5" />
      </Button>
      {showEnterHint && <EnterHint />}
    </>
  );
}

/** Tells the learner Enter does the same as the button above. */
export function EnterHint() {
  return <p className="-mt-2 text-center text-xs text-muted-foreground">or press Enter</p>;
}

interface ExerciseSrsDetailsProps {
  session: Session;
  card: Card;
  now: Date;
  /** The answer's rating, once given. */
  result?: AnswerResult;
  /** How the Exercise Type rates answers. */
  rules: string;
  open: boolean;
  onToggle: () => void;
}

/** The scheduler's view of the exercise's Card, for the curious. */
export function ExerciseSrsDetails({
  session,
  card,
  now,
  result,
  rules,
  open,
  onToggle,
}: ExerciseSrsDetailsProps) {
  const preview = previewReview(card.srs, now);
  const earlierReviews = session.reviews.filter((review) => review.cardId === card.id);

  return (
    <SrsDetails open={open} onToggle={onToggle}>
      {result && (
        <p>
          Rated <span className="font-semibold text-foreground">{ratingName(result.grade)}</span> ·{' '}
          {formatSeconds(result.elapsedMs)} · comes back in{' '}
          {formatDuration(preview[result.grade].card.due.getTime() - now.getTime())}
        </p>
      )}

      <div>
        <h3 className="mb-2 font-medium text-foreground">Card memory state (before review)</h3>
        <CardStats card={card.srs} now={now} />
      </div>

      {earlierReviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Earlier this session:</span>
          {earlierReviews.map((review, index) => (
            <span key={index} className="flex items-center gap-1">
              {ratingName(review.rating)} → <StateBadge state={review.srsAfter.state} />
            </span>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-medium text-foreground">Rating preview</h3>
        <p>
          Rated automatically: {rules}. Cards due within {formatDuration(LEARN_AHEAD_MS)} come back
          in this session.
        </p>
        <RatingPreview card={card.srs} now={now} highlight={result?.grade} />
      </div>
    </SrsDetails>
  );
}

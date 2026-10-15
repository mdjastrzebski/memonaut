import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Burst } from '@/components/burst';
import { GRADE_ICONS, GRADE_STYLES } from '@/components/grades';
import { AdvancedPanel, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import type { Card, Concept, Subject } from '@/domain/types';
import type { AnswerResult } from '@/exercises/type-answer';
import { formatNumber, formatRelative, formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Session, SubmitReviewInput } from '@/session/session';
import { previewReview, Rating, ratingName, State, type Grade } from '@/srs/scheduler';

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
  /** The Advanced panel with the scheduler's view, only with `?dev=1`. */
  advanced?: AdvancedToggle;
}

export interface AdvancedToggle {
  open: boolean;
  onToggle: () => void;
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

interface ExerciseAdvancedProps extends AdvancedToggle {
  card: Card;
  now: Date;
  /** The answer's rating, once given. */
  result?: AnswerResult;
}

/**
 * The scheduler's view of the exercise's Card, in short: its state and difficulty, and when it was
 * last and is next reviewed, changed by the answer once given.
 */
export function ExerciseAdvanced({ card, now, result, open, onToggle }: ExerciseAdvancedProps) {
  const before = card.srs;
  const after = result && previewReview(before, now)[result.grade].card;
  const isNew = before.state === State.New;
  const change = (from: ReactNode, to: ReactNode | undefined) => (
    <>
      {from}
      {to !== undefined && <> → {to}</>}
    </>
  );
  const rows: [label: string, value: ReactNode][] = [
    [
      'State',
      change(<StateBadge state={before.state} />, after && <StateBadge state={after.state} />),
    ],
    [
      'Difficulty',
      change(
        isNew ? '—' : formatNumber(before.difficulty, 1),
        after && formatNumber(after.difficulty, 1),
      ),
    ],
    ['Last review', before.last_review ? formatRelative(before.last_review, now) : '—'],
    ['Next review', after || !isNew ? formatRelative((after ?? before).due, now) : '—'],
  ];
  if (result) {
    rows.push(['Answer', `${ratingName(result.grade)} · ${formatSeconds(result.elapsedMs)}`]);
  }

  return (
    <AdvancedPanel open={open} onToggle={onToggle}>
      <dl className="flex flex-wrap gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt>{label}</dt>
            <dd className="flex items-center gap-1 font-medium text-foreground tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AdvancedPanel>
  );
}

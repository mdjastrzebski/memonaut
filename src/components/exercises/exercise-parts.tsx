import { ArrowRight } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { Burst } from '@/components/burst';
import { GRADE_ICONS, GRADE_STYLES } from '@/components/grades';
import { AdvancedPanel, SrsTermHint, StateBadge, type SrsTerm } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import type { Card, Concept, Subject } from '@/domain/types';
import type { AnswerResult } from '@/exercises/type-answer';
import { formatNumber, formatRelative, formatSeconds, formatXp } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  getScheduledGrade,
  isLastTry,
  type Session,
  type SubmitReviewInput,
} from '@/session/session';
import { getAnswerXp } from '@/session/xp';
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
  /** What the card is for screen readers; "Exercise" if left out. */
  label?: string;
  children: ReactNode;
}

/** The card an exercise is shown on. */
export function ExerciseCard({ hint, label = 'Exercise', children }: ExerciseCardProps) {
  return (
    <section
      aria-label={label}
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
  session: Session;
  card: Card;
  grade: Grade;
  children: ReactNode;
}

/**
 * The result as an icon, celebrated when right, next to what to remember about the word, and the XP
 * it earns.
 */
export function FeedbackPanel({ session, card, grade, children }: FeedbackPanelProps) {
  const style = GRADE_STYLES[grade];
  const Icon = GRADE_ICONS[grade];
  const right = grade === Rating.Good || grade === Rating.Easy;
  const xp = getAnswerXp(card.exerciseType, getScheduledGrade(session, card, grade));

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
      {xp > 0 && (
        <span className="ml-auto shrink-0 animate-pop self-start rounded-full border-2 border-line bg-almost px-2.5 py-0.5 font-display text-sm font-bold whitespace-nowrap text-foreground tabular-nums [animation-delay:150ms]">
          +{formatXp(xp)} XP
        </span>
      )}
    </div>
  );
}

/**
 * After a Card's last miss in the session, tells the learner it's left for next time, so it doesn't
 * seem forgotten or keep them stuck.
 */
export function NextTimeNote({ session, grade }: { session: Session; grade: Grade }) {
  if (grade !== Rating.Again || !isLastTry(session, grade)) return null;
  return (
    <p className="-mt-1 text-center text-sm font-semibold text-muted-foreground">
      We'll practise this one again next time.
    </p>
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
  session: Session;
  card: Card;
  now: Date;
  /** The answer's rating, once given. */
  result?: AnswerResult;
}

/**
 * The scheduler's view of the exercise's Card, in short: its state and difficulty, how often it was
 * reviewed and forgotten, and when it was last and is next reviewed; once answered, each as
 * before → after.
 */
export function ExerciseAdvanced({
  session,
  card,
  now,
  result,
  open,
  onToggle,
}: ExerciseAdvancedProps) {
  const before = card.srs;
  const grade = result && getScheduledGrade(session, card, result.grade);
  const after = grade && previewReview(before, now)[grade].card;
  const isNew = before.state === State.New;
  const change = (from: ReactNode, to: ReactNode | undefined) => (
    <>
      {from}
      {to !== undefined && <> → {to}</>}
    </>
  );
  const rows: [label: SrsTerm | 'Answer', value: ReactNode][] = [
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
    ['Reps', change(before.reps, after?.reps)],
    ['Lapses', change(before.lapses, after?.lapses)],
    [
      'Last review',
      change(before.last_review ? formatRelative(before.last_review, now) : '—', after && 'now'),
    ],
    [
      'Next review',
      change(
        isNew ? '—' : formatRelative(before.due, now),
        after && formatRelative(after.due, now),
      ),
    ],
  ];
  if (result && grade) {
    rows.push(['Answer', `${ratingName(grade)} · ${formatSeconds(result.elapsedMs)}`]);
  }

  return (
    <AdvancedPanel open={open} onToggle={onToggle}>
      <dl className="flex flex-wrap gap-x-6 gap-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <dt>{label === 'Answer' ? label : <SrsTermHint term={label} />}</dt>
            <dd className="flex items-center gap-1 font-medium text-foreground tabular-nums">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </AdvancedPanel>
  );
}

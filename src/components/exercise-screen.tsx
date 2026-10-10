import { ArrowRight, Check, RotateCcw, Target, Zap, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';

import { GRADE_STYLES } from '@/components/grades';
import { SessionProgress } from '@/components/session-progress';
import { SpecialCharacters } from '@/components/special-characters';
import { CardStats, RatingPreview, SrsDetails, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getFastLimitMs,
  gradeAnswer,
  type AnswerIssue,
  type AnswerResult,
} from '@/exercises/type-answer';
import { formatDuration, formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  getCurrentCard,
  LEARN_AHEAD_MS,
  type Session,
  type SubmitReviewInput,
} from '@/session/session';
import { previewReview, Rating, ratingName, type Grade } from '@/srs/scheduler';

const ISSUE_MESSAGES: Record<AnswerIssue, string> = {
  case: 'capital letters',
  diacritics: 'umlauts or ß',
  typo: 'one letter off',
};

const GRADE_ICONS: Record<Grade, LucideIcon> = {
  [Rating.Again]: RotateCcw,
  [Rating.Hard]: Target,
  [Rating.Good]: Check,
  [Rating.Easy]: Zap,
};

interface ExerciseScreenProps {
  session: Session;
  onReview: (review: SubmitReviewInput) => void;
  onEnd: () => void;
  specialCharacters?: string[];
  showSpecialCharacters: boolean;
  onToggleSpecialCharacters: () => void;
  showSrsDetails: boolean;
  onToggleSrsDetails: () => void;
}

interface Checked {
  result: AnswerResult;
  at: Date;
}

export function ExerciseScreen({
  session,
  onReview,
  onEnd,
  specialCharacters = [],
  showSpecialCharacters,
  onToggleSpecialCharacters,
  showSrsDetails,
  onToggleSrsDetails,
}: ExerciseScreenProps) {
  const [shownAt] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after inserting a special character.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [input]);

  const card = getCurrentCard(session);
  if (!card) return null;

  const concept = session.concepts[card.conceptId];
  const now = checked?.at ?? shownAt;
  const grade = checked?.result.grade;
  const fastLimitMs = getFastLimitMs(concept.answer);
  const preview = previewReview(card.srs, now);
  const earlierReviews = session.reviews.filter((review) => review.cardId === card.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!checked) {
      if (input.trim() === '') return;
      const at = new Date();
      const elapsedMs = at.getTime() - shownAt.getTime();
      setChecked({ result: gradeAnswer(concept.answer, input, elapsedMs), at });
    } else {
      const { grade, issues, elapsedMs } = checked.result;
      onReview({ input, elapsedMs, rating: grade, issues, now: checked.at });
    }
  };

  const insertCharacter = (character: string) => {
    const element = inputRef.current;
    const start = element?.selectionStart ?? input.length;
    const end = element?.selectionEnd ?? input.length;
    pendingCaret.current = start + character.length;
    setInput(input.slice(0, start) + character + input.slice(end));
    element?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <SessionProgress session={session} currentCardId={card.id} onEnd={onEnd} />

      <section
        aria-label="Exercise"
        className="relative animate-card-in overflow-hidden rounded-[2rem] border-2 border-foreground bg-card px-6 pt-7 pb-6 shadow-sticker-lg sm:px-10 sm:pt-9 sm:pb-8"
      >
        {concept.hint && (
          <span className="pointer-events-none absolute -top-4 right-4 rotate-6 font-display text-[8.5rem] leading-none font-black text-rocket/25 select-none sm:right-8 sm:text-[11rem]">
            {concept.hint}
          </span>
        )}

        <p className="relative inline-block -rotate-2 rounded-full border-2 border-foreground bg-almost px-3 py-0.5 text-xs font-bold tracking-wider uppercase">
          Type in German
        </p>
        <h2 className="relative mt-4 mb-8 font-display text-6xl font-extrabold tracking-tight break-words sm:text-7xl">
          {concept.prompt}
        </h2>

        <form onSubmit={handleSubmit} className="relative flex flex-col gap-4">
          <Input
            ref={inputRef}
            autoFocus
            aria-label="Answer"
            placeholder="Your answer…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={input}
            readOnly={checked !== null}
            onChange={(event) => setInput(event.target.value)}
            className={cn(
              'h-16 rounded-2xl border-2 border-foreground bg-background px-5 font-display text-3xl font-semibold shadow-[inset_0_3px_0_0_var(--color-border)] placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-foreground focus-visible:ring-rocket/40 md:text-3xl',
              grade !== undefined && GRADE_STYLES[grade].tint,
              grade === Rating.Again && 'animate-shake',
            )}
          />

          {!checked && (
            <>
              <FastBonus durationMs={fastLimitMs} />

              {showSpecialCharacters && specialCharacters.length > 0 && (
                <SpecialCharacters characters={specialCharacters} onInsert={insertCharacter} />
              )}

              <div className="flex gap-2">
                {specialCharacters.length > 0 && (
                  <Button
                    type="button"
                    variant="sticker"
                    className="h-13 rounded-2xl px-4 font-display text-lg"
                    aria-label="Show special characters"
                    aria-pressed={showSpecialCharacters}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={onToggleSpecialCharacters}
                  >
                    äöü
                  </Button>
                )}
                <Button type="submit" variant="cta" className="h-13 flex-1 rounded-2xl text-lg">
                  Check
                </Button>
              </div>
            </>
          )}

          {checked && grade !== undefined && (
            <>
              <Feedback
                result={checked.result}
                input={input}
                answer={concept.answer}
                nextInMs={preview[grade].card.due.getTime() - now.getTime()}
              />
              <Button type="submit" variant="cta" className="h-13 rounded-2xl text-lg">
                Continue <ArrowRight className="size-5" />
              </Button>
              <p className="-mt-2 text-center text-xs text-muted-foreground">or press Enter</p>
            </>
          )}
        </form>
      </section>

      <SrsDetails open={showSrsDetails} onToggle={onToggleSrsDetails}>
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
            Rated automatically: exact within {formatSeconds(fastLimitMs)} → Easy · exact → Good ·
            wrong case, missing umlaut or one letter off → Hard · otherwise → Again. Cards due
            within {formatDuration(LEARN_AHEAD_MS)} come back in this session.
          </p>
          <RatingPreview card={card.srs} now={now} highlight={grade} />
        </div>
      </SrsDetails>
    </div>
  );
}

/** A bar that drains while an exact answer would still be rated Easy. */
function FastBonus({ durationMs }: { durationMs: number }) {
  const duration = `${durationMs}ms`;
  return (
    <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      <Zap className="size-3.5 fill-rocket text-rocket" />
      <span>Fast bonus</span>
      <div className="h-2.5 flex-1 overflow-hidden rounded-full border-2 border-foreground/80 bg-background">
        <div
          className="h-full origin-left animate-drain rounded-full bg-rocket"
          style={{ 'animationDuration': duration, '--drain-ms': duration } as CSSProperties}
        />
      </div>
    </div>
  );
}

interface FeedbackProps {
  result: AnswerResult;
  input: string;
  answer: string;
  nextInMs: number;
}

function Feedback({ result, input, answer, nextInMs }: FeedbackProps) {
  const { grade, elapsedMs } = result;
  const style = GRADE_STYLES[grade];
  const Icon = GRADE_ICONS[grade];
  const wrong = grade === Rating.Hard || grade === Rating.Again;

  return (
    <div
      role="status"
      className={cn(
        'flex animate-rise items-start gap-4 rounded-2xl border-2 border-foreground p-4',
        style.tint,
      )}
    >
      <span className="relative shrink-0">
        <span
          className={cn(
            'grid size-11 animate-pop place-items-center rounded-full border-2 border-foreground',
            style.fill,
          )}
        >
          <Icon className="size-5" strokeWidth={3} />
        </span>
        {!wrong && <Burst />}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        <p className={cn('font-display text-xl font-bold', style.text)}>{getHeadline(result)}</p>
        {wrong && (
          <p>
            You typed <span className="font-medium line-through decoration-2">{input}</span>. The
            answer is <span className="font-display text-lg font-bold">{answer}</span>.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Rated <span className="font-semibold text-foreground">{ratingName(grade)}</span> ·{' '}
          {formatSeconds(elapsedMs)} · comes back in {formatDuration(nextInMs)}
        </p>
      </div>
    </div>
  );
}

/** Confetti dots flying out of the feedback icon. */
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          key={index}
          className={cn(
            'absolute size-2 animate-burst rounded-full',
            index % 2 ? 'bg-rocket' : 'bg-almost',
          )}
          style={{ '--angle': `${index * 45}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}

function getHeadline({ grade, issues }: AnswerResult): string {
  switch (grade) {
    case Rating.Easy:
      return 'Correct and fast!';
    case Rating.Good:
      return 'Correct!';
    case Rating.Hard:
      return `Almost! Check: ${issues.map((issue) => ISSUE_MESSAGES[issue]).join(', ')}.`;
    case Rating.Again:
      return 'Not quite.';
  }
}

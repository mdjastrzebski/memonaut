import { ArrowRight, Check, RotateCcw, Target, Volume2, Zap, type LucideIcon } from 'lucide-react';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';

import { AnswerComparison } from '@/components/answer-comparison';
import { GRADE_STYLES } from '@/components/grades';
import { SessionProgress } from '@/components/session-progress';
import { SpecialCharacters } from '@/components/special-characters';
import { CardStats, RatingPreview, SrsDetails, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getFastLimitMs, gradeAnswer, type AnswerResult } from '@/exercises/type-answer';
import { formatDuration, formatSeconds } from '@/lib/format';
import { playCorrect } from '@/lib/sounds';
import { speak } from '@/lib/speech';
import { cn } from '@/lib/utils';
import {
  getCurrentCard,
  LEARN_AHEAD_MS,
  type Session,
  type SubmitReviewInput,
} from '@/session/session';
import { previewReview, Rating, ratingName, type Grade } from '@/srs/scheduler';

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
  /** BCP 47 tag used to read words aloud in dictation exercises. */
  foreignLanguage: string;
  specialCharacters?: string[];
  showSpecialCharacters: boolean;
  onToggleSpecialCharacters: () => void;
  showSrsDetails: boolean;
  onToggleSrsDetails: () => void;
}

const INPUT_CLASS =
  'h-16 rounded-2xl border-2 border-foreground bg-background px-5 font-display text-3xl font-semibold shadow-[inset_0_3px_0_0_var(--color-border)] placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-foreground focus-visible:ring-rocket/40 md:text-3xl';

interface Checked {
  result: AnswerResult;
  at: Date;
}

export function ExerciseScreen({
  session,
  onReview,
  onEnd,
  foreignLanguage,
  specialCharacters = [],
  showSpecialCharacters,
  onToggleSpecialCharacters,
  showSrsDetails,
  onToggleSrsDetails,
}: ExerciseScreenProps) {
  const [shownAt] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const [retyped, setRetyped] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  const card = getCurrentCard(session);
  const concept = card && session.concepts[card.conceptId];
  const dictation = card?.exerciseType === 'dictation';
  const playWord = () => concept && speak(concept.foreign, foreignLanguage);

  // Read the word aloud as soon as a dictation exercise appears. The ref keeps StrictMode's second
  // effect run from cancelling and queueing it again.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (dictation && !autoPlayed.current) {
      autoPlayed.current = true;
      playWord();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once per exercise
  }, []);

  // Kids don't notice when the answer box loses focus, so typing anywhere goes back to it and Enter
  // submits. Enter on a focused button still presses that button.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = inputRef.current;
      const target = event.target as HTMLElement;
      if (!element || target === element || event.defaultPrevented || event.isComposing) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Enter') {
        if (target.closest('button, a')) return;
        event.preventDefault();
        element.focus();
        formRef.current?.requestSubmit();
      } else if (event.key.length === 1 || event.key === 'Backspace') {
        element.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Restore the caret after inserting a special character.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [input, retyped]);

  if (!card || !concept) return null;

  const now = checked?.at ?? shownAt;
  const grade = checked?.result.grade;
  const fastLimitMs = getFastLimitMs(concept.foreign);
  const preview = previewReview(card.srs, now);
  const earlierReviews = session.reviews.filter((review) => review.cardId === card.id);
  // After a wrong or almost-right answer, the learner types the right one before moving on.
  const retyping = checked !== null && (grade === Rating.Hard || grade === Rating.Again);
  const retypedCorrectly = retyping && retyped === concept.foreign;
  const [value, setValue] = retyping ? [retyped, setRetyped] : [input, setInput];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!checked) {
      if (input.trim() === '') return;
      const at = new Date();
      const elapsedMs = at.getTime() - shownAt.getTime();
      const result = gradeAnswer(concept.foreign, input, elapsedMs);
      setChecked({ result, at });
      if (result.grade === Rating.Good || result.grade === Rating.Easy) playCorrect();
      // In translation, the learner hears the German word once they've typed it.
      if (!dictation) playWord();
    } else if (!retyping || retypedCorrectly) {
      const { grade, issues, elapsedMs } = checked.result;
      onReview({ input, elapsedMs, rating: grade, issues, now: checked.at });
    }
  };

  const insertCharacter = (character: string) => {
    const element = inputRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    pendingCaret.current = start + character.length;
    setValue(value.slice(0, start) + character + value.slice(end));
    element?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <SessionProgress session={session} onEnd={onEnd} />

      <section
        aria-label="Exercise"
        className="relative animate-card-in overflow-hidden rounded-[2rem] border-2 border-foreground bg-card px-6 pt-7 pb-6 shadow-sticker-lg sm:px-10 sm:pt-9 sm:pb-8"
      >
        {/* A hint like "3" would give away the word's meaning in dictation. */}
        {concept.hint && !dictation && (
          <span className="pointer-events-none absolute -top-4 right-4 rotate-6 font-display text-[8.5rem] leading-none font-black text-rocket/25 select-none sm:right-8 sm:text-[11rem]">
            {concept.hint}
          </span>
        )}

        <p className="relative inline-block -rotate-2 rounded-full border-2 border-foreground bg-almost px-3 py-0.5 text-xs font-bold tracking-wider uppercase">
          {dictation ? 'Write what you hear' : 'Type in German'}
        </p>
        {dictation ? (
          <div className="relative mt-4 mb-8">
            <Button
              type="button"
              variant="sticker"
              aria-label="Listen"
              className="size-20 rounded-2xl"
              onMouseDown={(event) => event.preventDefault()}
              onClick={playWord}
            >
              <Volume2 className="size-9" />
            </Button>
          </div>
        ) : (
          <h2 className="relative mt-4 mb-8 font-display text-6xl font-extrabold tracking-tight break-words sm:text-7xl">
            {concept.local}
          </h2>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className="relative flex flex-col gap-4">
          {retyping ? (
            <>
              <Feedback
                grade={checked.result.grade}
                input={input}
                answer={concept.foreign}
                meaning={concept.local}
              />
              <p className="-mb-2 font-semibold">Now type the answer to continue:</p>
              <div className="relative">
                <Input
                  ref={inputRef}
                  autoFocus
                  aria-label="Retype answer"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={retyped}
                  readOnly={retypedCorrectly}
                  onChange={(event) => setRetyped(event.target.value)}
                  className={cn(
                    INPUT_CLASS,
                    'text-transparent caret-foreground',
                    retypedCorrectly && GRADE_STYLES[Rating.Good].tint,
                  )}
                />
                <RetypeGuide answer={concept.foreign} typed={retyped} />
              </div>
            </>
          ) : (
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
              className={cn(INPUT_CLASS, grade !== undefined && GRADE_STYLES[grade].tint)}
            />
          )}

          {(!checked || retyping) && (
            <>
              {!checked && <FastBonus durationMs={fastLimitMs} />}

              {showSpecialCharacters && specialCharacters.length > 0 && !retypedCorrectly && (
                <SpecialCharacters characters={specialCharacters} onInsert={insertCharacter} />
              )}

              <div className="flex gap-2">
                {specialCharacters.length > 0 && !retypedCorrectly && (
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
                <Button
                  type="submit"
                  variant="cta"
                  disabled={retyping && !retypedCorrectly}
                  className="h-13 flex-1 rounded-2xl text-lg"
                >
                  {retyping ? (
                    <>
                      Continue <ArrowRight className="size-5" />
                    </>
                  ) : (
                    'Check'
                  )}
                </Button>
              </div>
              {retypedCorrectly && (
                <p className="-mt-2 text-center text-xs text-muted-foreground">or press Enter</p>
              )}
            </>
          )}

          {checked && !retyping && (
            <>
              <Feedback
                grade={checked.result.grade}
                input={input}
                answer={concept.foreign}
                meaning={concept.local}
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
        {checked && (
          <p>
            Rated{' '}
            <span className="font-semibold text-foreground">
              {ratingName(checked.result.grade)}
            </span>{' '}
            · {formatSeconds(checked.result.elapsedMs)} · comes back in{' '}
            {formatDuration(preview[checked.result.grade].card.due.getTime() - now.getTime())}
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

/** A faint line that drains while an exact answer would still be rated Easy. */
function FastBonus({ durationMs }: { durationMs: number }) {
  const duration = `${durationMs}ms`;
  return (
    <div aria-hidden className="flex items-center gap-1.5 opacity-40">
      <Zap className="size-3 text-muted-foreground" />
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full origin-left animate-drain rounded-full bg-muted-foreground"
          style={{ 'animationDuration': duration, '--drain-ms': duration } as CSSProperties}
        />
      </div>
    </div>
  );
}

interface FeedbackProps {
  grade: Grade;
  input: string;
  answer: string;
  /** The local word, shown with the result. */
  meaning: string;
}

/** The result as an icon, the answer to compare after a mistake, and the word's meaning. */
function Feedback({ grade, input, answer, meaning }: FeedbackProps) {
  const style = GRADE_STYLES[grade];
  const Icon = GRADE_ICONS[grade];
  const wrong = grade === Rating.Hard || grade === Rating.Again;

  return (
    <div
      role="status"
      className={cn(
        'flex animate-rise items-center gap-4 rounded-2xl border-2 border-foreground p-4',
        style.tint,
      )}
    >
      <span className="relative shrink-0 self-start">
        <span
          className={cn(
            'grid size-11 animate-pop place-items-center rounded-full border-2 border-foreground',
            style.fill,
          )}
        >
          <Icon className="size-5" strokeWidth={3} />
          <span className="sr-only">{ratingName(grade)}</span>
        </span>
        {!wrong && <Burst />}
      </span>

      <div className="flex min-w-0 flex-col gap-1">
        {wrong && <AnswerComparison input={input} answer={answer} shake={grade === Rating.Again} />}
        <p
          className={cn(
            'flex items-center gap-2 font-display font-bold break-words',
            wrong ? 'text-lg text-muted-foreground' : 'text-2xl',
          )}
        >
          <span aria-hidden className="shrink-0 leading-none">
            🇵🇱
          </span>
          <span className="sr-only">means</span>
          <span className="min-w-0">{meaning}</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Draws the retyped letters over the transparent input text: right ones as typed, wrong ones in
 * red, then the rest of the answer as a faded guide to copy.
 */
function RetypeGuide({ answer, typed }: { answer: string; typed: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center overflow-hidden border-2 border-transparent px-5 font-display text-3xl font-semibold whitespace-pre"
    >
      {typed.split('').map((letter, index) => (
        <span
          key={index}
          className={cn(letter !== answer[index] && 'rounded-sm bg-wrong/30 text-wrong-ink')}
        >
          {letter}
        </span>
      ))}
      <span className="text-muted-foreground/50">{answer.slice(typed.length)}</span>
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

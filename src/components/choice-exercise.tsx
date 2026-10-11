import { ArrowRight, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Burst } from '@/components/burst';
import type { ExerciseScreenProps } from '@/components/exercise-screen';
import { GRADE_ICONS, GRADE_STYLES } from '@/components/grades';
import { CardStats, RatingPreview, SrsDetails } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { gradeChoice, pickChoices, type ChoiceSide } from '@/exercises/multiple-choice';
import type { AnswerResult } from '@/exercises/type-answer';
import { formatDuration, formatSeconds } from '@/lib/format';
import { playCorrect } from '@/lib/sounds';
import { speak } from '@/lib/speech';
import { cn } from '@/lib/utils';
import { getCurrentCard, LEARN_AHEAD_MS } from '@/session/session';
import { previewReview, Rating, ratingName, type Grade } from '@/srs/scheduler';

interface ChoiceExerciseProps extends Omit<
  ExerciseScreenProps,
  'showSpecialCharacters' | 'onToggleSpecialCharacters'
> {
  /** The word offered as options: local in recognition, foreign in translation. */
  side: ChoiceSide;
}

interface Picked {
  option: string;
  result: AnswerResult;
  at: Date;
}

/**
 * A multiple-choice exercise. In recognition the learner sees and hears the foreign word and picks
 * the local one; in translation it's the other way round. Options can be picked with keys 1–4.
 */
export function ChoiceExercise({
  session,
  onReview,
  subject,
  subjectConcepts,
  side,
  showSrsDetails,
  onToggleSrsDetails,
}: ChoiceExerciseProps) {
  const [shownAt] = useState(() => new Date());
  const [picked, setPicked] = useState<Picked | null>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  const card = getCurrentCard(session)!;
  const concept = session.concepts[card.conceptId];
  const recognition = side === 'local';
  const answer = concept[side]!;
  const [options] = useState(() =>
    pickChoices(concept, {
      side,
      deckConcepts: subjectConcepts.filter((other) => session.deck.conceptIds.includes(other.id)),
      subjectConcepts,
    }),
  );
  const playWord = () => speak(concept.foreign, subject.foreignLanguage);

  // Read the word aloud as soon as a recognition exercise appears. The ref keeps StrictMode's
  // second effect run from cancelling and queueing it again.
  const autoPlayed = useRef(false);
  useEffect(() => {
    if (recognition && !autoPlayed.current) {
      autoPlayed.current = true;
      playWord();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only once per exercise
  }, []);

  const pick = (option: string) => {
    if (picked) return;
    const at = new Date();
    const result = gradeChoice(answer, option, at.getTime() - shownAt.getTime());
    setPicked({ option, result, at });
    if (result.grade === Rating.Good) playCorrect();
    // In translation, the learner hears the foreign word once they've picked it.
    if (!recognition) playWord();
  };

  const submit = () => {
    if (!picked) return;
    const { grade, issues, elapsedMs } = picked.result;
    onReview({ input: picked.option, elapsedMs, rating: grade, issues, now: picked.at });
  };

  useEffect(() => {
    if (picked) continueRef.current?.focus();
  }, [picked]);

  // Number keys pick an option; Enter continues once picked.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.defaultPrevented || event.isComposing) return;
      if (target.closest('[role="menu"], [role="dialog"], input, textarea')) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const index = Number(event.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length) {
        event.preventDefault();
        pick(options[index]);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  });

  const now = picked?.at ?? shownAt;
  const grade = picked?.result.grade;
  const preview = previewReview(card.srs, now);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <section
        aria-label="Exercise"
        className="relative animate-card-in overflow-hidden rounded-[2rem] border-2 border-line bg-card px-6 pt-6 pb-6 shadow-sticker-lg sm:px-10 sm:pt-8 sm:pb-8"
      >
        {/* A hint like "3" would give away the meaning in recognition. */}
        {concept.hint && !recognition && (
          <span className="pointer-events-none absolute -top-4 right-4 rotate-6 font-display text-[8.5rem] leading-none font-black text-rocket/25 select-none sm:right-8 sm:text-[11rem]">
            {concept.hint}
          </span>
        )}

        <p className="relative mb-1 text-sm font-semibold text-muted-foreground">
          {recognition ? 'What does it mean?' : 'Which word is it?'}
        </p>
        <div className="relative mb-6 flex items-center gap-4">
          <h2 className="min-w-0 font-display text-4xl font-extrabold tracking-tight break-words sm:text-5xl">
            {recognition ? concept.foreign : concept.local}
          </h2>
          {recognition && (
            <Button
              type="button"
              variant="sticker"
              aria-label="Listen"
              className="size-12 shrink-0 rounded-2xl"
              onClick={playWord}
            >
              <Volume2 className="size-6" />
            </Button>
          )}
        </div>

        <div role="group" aria-label="Options" className="relative grid gap-3 sm:grid-cols-2">
          {options.map((option, index) => {
            const right = option === answer;
            const chosen = option === picked?.option;
            const style =
              picked && right
                ? GRADE_STYLES[Rating.Good]
                : chosen
                  ? GRADE_STYLES[Rating.Again]
                  : undefined;
            return (
              <Button
                key={option}
                type="button"
                variant="sticker"
                aria-disabled={picked !== null}
                onClick={() => pick(option)}
                className={cn(
                  'h-auto min-h-16 justify-start gap-3 rounded-2xl px-4 py-3 text-left font-display text-xl font-bold whitespace-normal',
                  style && [style.tint, style.border],
                  picked && !style && 'opacity-50',
                  picked && 'pointer-events-none',
                )}
              >
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-lg border-2 border-line bg-background text-sm"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 break-words">{option}</span>
              </Button>
            );
          })}
        </div>

        {picked && grade !== undefined && (
          <div className="relative mt-4 flex flex-col gap-4">
            <ChoiceFeedback
              grade={grade}
              foreign={concept.foreign}
              local={concept.local}
              onListen={playWord}
            />
            <Button
              ref={continueRef}
              type="button"
              variant="cta"
              className="h-13 rounded-2xl text-lg"
              onClick={submit}
            >
              Continue <ArrowRight className="size-5" />
            </Button>
            <p className="-mt-2 text-center text-xs text-muted-foreground">or press Enter</p>
          </div>
        )}
      </section>

      <SrsDetails open={showSrsDetails} onToggle={onToggleSrsDetails}>
        {picked && (
          <p>
            Rated{' '}
            <span className="font-semibold text-foreground">{ratingName(picked.result.grade)}</span>{' '}
            · {formatSeconds(picked.result.elapsedMs)} · comes back in{' '}
            {formatDuration(preview[picked.result.grade].card.due.getTime() - now.getTime())}
          </p>
        )}

        <div>
          <h3 className="mb-2 font-medium text-foreground">Card memory state (before review)</h3>
          <CardStats card={card.srs} now={now} />
        </div>

        <div>
          <h3 className="font-medium text-foreground">Rating preview</h3>
          <p>
            Rated automatically: right → Good · wrong → Again. Never Easy, since picking a word is
            easier than recalling it. Cards due within {formatDuration(LEARN_AHEAD_MS)} come back in
            this session.
          </p>
          <RatingPreview card={card.srs} now={now} highlight={grade} />
        </div>
      </SrsDetails>
    </div>
  );
}

interface ChoiceFeedbackProps {
  grade: Grade;
  foreign: string;
  local?: string;
  onListen: () => void;
}

/** The result as an icon, with the word and its meaning to remember. */
function ChoiceFeedback({ grade, foreign, local, onListen }: ChoiceFeedbackProps) {
  const style = GRADE_STYLES[grade];
  const Icon = GRADE_ICONS[grade];
  const right = grade === Rating.Good;

  return (
    <div
      role="status"
      className={cn(
        'flex animate-rise items-center gap-4 rounded-2xl border-2 border-line p-4',
        style.tint,
      )}
    >
      <span className="relative shrink-0">
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

      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-display text-xl font-bold break-words">
        <span>{foreign}</span>
        <span aria-hidden className="text-muted-foreground">
          =
        </span>
        <span className="sr-only">means</span>
        <span>{local}</span>
      </p>
      <Button
        type="button"
        variant="ghost"
        aria-label="Listen again"
        className="size-10 shrink-0 rounded-xl"
        onClick={onListen}
      >
        <Volume2 className="size-5" />
      </Button>
    </div>
  );
}

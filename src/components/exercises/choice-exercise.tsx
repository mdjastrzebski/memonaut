import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  ContinueButton,
  ExerciseCard,
  ExerciseSrsDetails,
  FeedbackPanel,
  type ExerciseProps,
} from '@/components/exercises/exercise-parts';
import { useAnswer } from '@/components/exercises/use-answer';
import { FastBonus } from '@/components/fast-bonus';
import { GRADE_STYLES } from '@/components/grades';
import { Button } from '@/components/ui/button';
import {
  FAST_CHOICE_MS,
  gradeChoice,
  pickChoices,
  type ChoiceSide,
} from '@/exercises/multiple-choice';
import { formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Rating } from '@/srs/scheduler';

interface ChoiceExerciseProps extends ExerciseProps {
  /** The word offered as options: local in recognition, foreign in translation. */
  side: ChoiceSide;
  /** Asked above the prompt, e.g. "What does it mean?". */
  question: string;
  /** The word to find the other one for. */
  prompt: ReactNode;
  /** Extra context drawn large in the corner, e.g. "3". */
  hint?: string;
  /** Reads the foreign word aloud again from the feedback. */
  onListen: () => void;
  /** Called once an option is picked, e.g. to read the word aloud. */
  onPicked?: () => void;
}

/** A multiple-choice exercise: the learner picks the right word for the prompt, also with keys 1–4. */
export function ChoiceExercise({
  session,
  card,
  concept,
  onReview,
  subjectConcepts,
  showSrsDetails,
  onToggleSrsDetails,
  side,
  question,
  prompt,
  hint,
  onListen,
  onPicked,
}: ChoiceExerciseProps) {
  const { answered: picked, check, submit, now } = useAnswer(onReview);
  const continueRef = useRef<HTMLButtonElement>(null);

  const answer = concept[side]!;
  const [options] = useState(() =>
    pickChoices(concept, {
      side,
      deckConcepts: subjectConcepts.filter((other) => session.deck.conceptIds.includes(other.id)),
      subjectConcepts,
    }),
  );

  const pick = (option: string) => {
    if (picked) return;
    check(option, (elapsedMs) => gradeChoice(answer, option, elapsedMs));
    onPicked?.();
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

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <ExerciseCard hint={hint}>
        <p className="relative mb-1 text-sm font-semibold text-muted-foreground">{question}</p>
        <div className="relative mb-6 flex items-center gap-4">{prompt}</div>

        <div role="group" aria-label="Options" className="relative grid gap-3 sm:grid-cols-2">
          {options.map((option, index) => {
            const right = option === answer;
            const chosen = option === picked?.input;
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

        {!picked && (
          <div className="relative mt-4">
            <FastBonus durationMs={FAST_CHOICE_MS} />
          </div>
        )}

        {picked && (
          <div className="relative mt-4 flex flex-col gap-4">
            <FeedbackPanel grade={picked.result.grade}>
              <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-display text-xl font-bold break-words">
                <span>{concept.foreign}</span>
                <span aria-hidden className="text-muted-foreground">
                  =
                </span>
                <span className="sr-only">means</span>
                <span>{concept.local}</span>
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
            </FeedbackPanel>
            <ContinueButton ref={continueRef} type="button" onClick={submit} />
          </div>
        )}
      </ExerciseCard>

      <ExerciseSrsDetails
        session={session}
        card={card}
        now={now}
        result={picked?.result}
        rules={`right within ${formatSeconds(FAST_CHOICE_MS)} → Easy · right → Good · wrong → Again`}
        open={showSrsDetails}
        onToggle={onToggleSrsDetails}
      />
    </div>
  );
}

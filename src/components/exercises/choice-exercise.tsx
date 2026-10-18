import { Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import {
  ContinueButton,
  ExerciseCard,
  ExerciseAdvanced,
  FeedbackPanel,
  NextTimeNote,
  type ExerciseProps,
} from '@/components/exercises/exercise-parts';
import { useAnswer } from '@/components/exercises/use-answer';
import { FastBonus } from '@/components/fast-bonus';
import { GRADE_STYLES } from '@/components/grades';
import { Button } from '@/components/ui/button';
import { FAST_CHOICE_MS, gradeChoice } from '@/exercises/multiple-choice';
import { cn } from '@/lib/utils';
import { Rating } from '@/srs/scheduler';

export interface ChoiceExerciseProps extends ExerciseProps {
  /** Asked above the prompt, e.g. "What does it mean?". */
  question: string;
  /** What to find the answer for, e.g. the word or the question. */
  prompt: ReactNode;
  /** The right option. */
  answer: string;
  /** The options, the answer among them, in the order shown. Called once. */
  pickOptions: () => string[];
  /** Shown with the result, e.g. the word and its meaning. */
  feedback: ReactNode;
  /** Extra context drawn large in the corner, e.g. "3". */
  hint?: string;
  /** Reads the word aloud again from the feedback; no button when left out. */
  onListen?: () => void;
  /** Called once an option is picked, e.g. to read the word aloud. */
  onPicked?: () => void;
  /** Draws an option, e.g. in its own color; as plain text if left out. */
  renderOption?: (option: string) => ReactNode;
}

/** A multiple-choice exercise: the learner picks the right option for the prompt, also with keys 1–4. */
export function ChoiceExercise({
  session,
  card,
  onReview,
  advanced,
  question,
  prompt,
  answer,
  pickOptions,
  feedback,
  hint,
  onListen,
  onPicked,
  renderOption = (option) => option,
}: ChoiceExerciseProps) {
  const { answered: picked, check, submit, now } = useAnswer(session, card, onReview);
  const continueRef = useRef<HTMLButtonElement>(null);
  const [options] = useState(pickOptions);

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

        <div
          role="group"
          aria-label="Options"
          className={cn(
            'relative grid gap-3',
            options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
          )}
        >
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
                <span className="min-w-0 break-words">{renderOption(option)}</span>
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
            <FeedbackPanel session={session} card={card} grade={picked.result.grade}>
              <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 font-display text-xl font-bold break-words">
                {feedback}
              </p>
              {onListen && (
                <Button
                  type="button"
                  variant="ghost"
                  aria-label="Listen again"
                  className="size-10 shrink-0 rounded-xl"
                  onClick={onListen}
                >
                  <Volume2 className="size-5" />
                </Button>
              )}
            </FeedbackPanel>
            <NextTimeNote session={session} grade={picked.result.grade} />
            <ContinueButton ref={continueRef} type="button" onClick={submit} />
          </div>
        )}
      </ExerciseCard>

      {advanced && (
        <ExerciseAdvanced
          session={session}
          card={card}
          now={now}
          result={picked?.result}
          {...advanced}
        />
      )}
    </div>
  );
}

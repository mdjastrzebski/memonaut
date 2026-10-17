import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';

import { AnswerComparison } from '@/components/answer-comparison';
import {
  ContinueButton,
  EnterHint,
  ExerciseCard,
  ExerciseAdvanced,
  FeedbackPanel,
  NextTimeNote,
  type ExerciseProps,
} from '@/components/exercises/exercise-parts';
import { useAnswer } from '@/components/exercises/use-answer';
import { FastBonus } from '@/components/fast-bonus';
import { GRADE_STYLES } from '@/components/grades';
import { MarkedText } from '@/components/marked-text';
import { SpecialCharacters } from '@/components/special-characters';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { alignAnswer, diffAnswer } from '@/exercises/answer-diff';
import { splitTrickySpellings } from '@/exercises/tricky-spellings';
import { getFastLimitMs, gradeAnyAnswer, normalizeSpacing } from '@/exercises/type-answer';
import { cn } from '@/lib/utils';
import { Rating, type Grade } from '@/srs/scheduler';

const INPUT_CLASS =
  'h-16 rounded-2xl border-2 border-line bg-background px-5 font-display text-3xl font-semibold shadow-[inset_0_3px_0_0_var(--border)] placeholder:font-normal placeholder:text-muted-foreground/60 focus-visible:border-line focus-visible:ring-rocket/40 md:text-3xl';

interface TypedExerciseProps extends ExerciseProps {
  /** What the learner answers, shown above the answer box. */
  prompt: ReactNode;
  /** What to type, e.g. the foreign word. */
  answer: string;
  /** Other right answers, e.g. "einhundert" for "hundert". */
  alternatives?: string[];
  /** The local word, or else the spoken hint, shown with the result with a flag. */
  meaning?: string;
  /**
   * Shown with the result below the meaning, with parts in square brackets highlighted, e.g.
   * "3² = 9" or "das Buch → die B[ü]ch[er]".
   */
  explanation?: string;
  /** Extra context drawn large in the corner, e.g. "3". */
  hint?: string;
  /** Forgives only wrong capitalization, e.g. for a short word, as in a strict-spelling Deck. */
  strict?: boolean;
  /** Called once the answer is checked, e.g. to read the word aloud. */
  onChecked?: () => void;
}

/**
 * An exercise where the learner types the answer, e.g. the foreign word. After a wrong or
 * almost-right answer, they type the right one before moving on: when it was close, by fixing the
 * marked letters of their own answer, or else by copying it.
 */
export function TypedExercise({
  session,
  card,
  onReview,
  subject,
  showSpecialCharacters,
  onToggleSpecialCharacters,
  advanced,
  prompt,
  answer,
  alternatives = [],
  meaning,
  explanation,
  hint,
  strict: strictAnswer = false,
  onChecked,
}: TypedExerciseProps) {
  const { answered: checked, check, submit, now } = useAnswer(onReview);
  const [input, setInput] = useState('');
  const [retyped, setRetyped] = useState('');
  // The right answer the input was rated against: the closest one when there are several.
  const [rightAnswer, setRightAnswer] = useState(answer);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSelection = useRef<[start: number, end: number] | null>(null);

  const specialCharacters = subject.specialCharacters ?? [];
  const strict = strictAnswer || session.deck.strictSpelling;

  // Kids don't notice when the answer box loses focus, so typing anywhere goes back to it and Enter
  // submits. Enter on a focused button still presses that button.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const element = inputRef.current;
      const target = event.target as HTMLElement;
      if (!element || target === element || event.defaultPrevented || event.isComposing) return;
      // Leave keys to an open menu or dialog, e.g. Enter on "Finish now".
      if (target.closest('[role="menu"], [role="dialog"]')) return;
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

  // Restore the caret after inserting a special character, or select the first letter to fix.
  useLayoutEffect(() => {
    if (pendingSelection.current !== null) {
      inputRef.current?.setSelectionRange(...pendingSelection.current);
      pendingSelection.current = null;
    }
  }, [input, retyped]);

  const grade = checked?.result.grade;
  const fastLimitMs = getFastLimitMs(answer);
  // After a wrong or almost-right answer, the learner types the right one before moving on.
  const retyping = checked !== null && (grade === Rating.Hard || grade === Rating.Again);
  // Started from their own answer when it was close.
  const fixing = retyping && diffAnswer(rightAnswer, checked.input) !== undefined;
  const retypedCorrectly = retyping && retyped === rightAnswer;
  const [value, setValue] = retyping ? [retyped, setRetyped] : [input, setInput];

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!checked) {
      if (input.trim() === '') return;
      check(input, (elapsedMs) => {
        const best = gradeAnyAnswer([answer, ...alternatives], input, elapsedMs, { strict });
        setRightAnswer(best.answer);
        const wrong = best.result.grade === Rating.Hard || best.result.grade === Rating.Again;
        if (wrong && diffAnswer(best.answer, input)) {
          const typed = normalizeSpacing(input);
          setRetyped(typed);
          pendingSelection.current = getFirstFix(best.answer, typed);
        }
        return best.result;
      });
      onChecked?.();
    } else if (!retyping || retypedCorrectly) {
      submit();
    }
  };

  const insertCharacter = (character: string) => {
    const element = inputRef.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    pendingSelection.current = [start + character.length, start + character.length];
    setValue(value.slice(0, start) + character + value.slice(end));
    element?.focus();
  };

  const feedback = checked && (
    <TypedFeedback
      grade={checked.result.grade}
      input={checked.input}
      answer={rightAnswer}
      meaning={meaning}
      explanation={explanation}
      trickySpellings={subject.trickySpellings}
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <ExerciseCard hint={hint}>
        <div className="relative mb-6">{prompt}</div>

        <form ref={formRef} onSubmit={handleSubmit} className="relative flex flex-col gap-4">
          {retyping ? (
            <>
              {feedback}
              <NextTimeNote session={session} grade={checked.result.grade} />
              <p className="-mb-2 font-semibold">
                {fixing
                  ? 'Fix the marked letters to continue:'
                  : 'Now type the answer to continue:'}
              </p>
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
                <RetypeGuide answer={rightAnswer} typed={retyped} />
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
                    {specialCharacters.slice(0, 3).join('')}
                  </Button>
                )}
                {retyping ? (
                  <ContinueButton
                    type="submit"
                    disabled={!retypedCorrectly}
                    showEnterHint={false}
                    className="flex-1"
                  />
                ) : (
                  <Button type="submit" variant="cta" className="h-13 flex-1 rounded-2xl text-lg">
                    Check
                  </Button>
                )}
              </div>
              {retypedCorrectly && <EnterHint />}
            </>
          )}

          {checked && !retyping && (
            <>
              {feedback}
              <ContinueButton type="submit" />
            </>
          )}
        </form>
      </ExerciseCard>

      {advanced && (
        <ExerciseAdvanced
          session={session}
          card={card}
          now={now}
          result={checked?.result}
          {...advanced}
        />
      )}
    </div>
  );
}

interface TypedFeedbackProps {
  grade: Grade;
  input: string;
  answer: string;
  /** The local word, or else the spoken hint, shown with the result. */
  meaning?: string;
  /** Shown below the meaning, e.g. "3² = 9". */
  explanation?: string;
  /** Marked in a right answer. */
  trickySpellings?: string[];
}

/**
 * The result, with the answer to compare after a mistake or else with its tricky spellings marked,
 * and the word's meaning and explanation.
 */
function TypedFeedback({
  grade,
  input,
  answer,
  meaning,
  explanation,
  trickySpellings,
}: TypedFeedbackProps) {
  const wrong = grade === Rating.Hard || grade === Rating.Again;
  const spelled = !wrong && trickySpellings !== undefined;
  const textSize = wrong || spelled ? 'text-lg text-muted-foreground' : 'text-2xl';

  return (
    <FeedbackPanel grade={grade}>
      <div className="flex min-w-0 flex-col gap-1">
        {wrong && <AnswerComparison input={input} answer={answer} shake={grade === Rating.Again} />}
        {spelled && <SpelledAnswer answer={answer} trickySpellings={trickySpellings} />}
        {meaning && (
          <p className={cn('flex items-center gap-2 font-display font-bold break-words', textSize)}>
            <span aria-hidden className="shrink-0 leading-none">
              🇵🇱
            </span>
            <span className="sr-only">means</span>
            <span className="min-w-0">{meaning}</span>
          </p>
        )}
        {explanation && (
          <p className={cn('font-display font-bold break-words', textSize)}>
            <MarkedText text={explanation} />
          </p>
        )}
      </div>
    </FeedbackPanel>
  );
}

/** The answer with its tricky spellings marked, e.g. "bo[h]ater". */
function SpelledAnswer({ answer, trickySpellings }: { answer: string; trickySpellings: string[] }) {
  return (
    <p className="font-display text-2xl font-bold break-words whitespace-pre-wrap">
      {splitTrickySpellings(answer, trickySpellings).map(({ text, tricky }, index) =>
        tricky ? (
          <mark key={index} className="rounded-md bg-highlight px-0.5 text-foreground">
            {text}
          </mark>
        ) : (
          <span key={index}>{text}</span>
        ),
      )}
    </p>
  );
}

/**
 * The letters of `typed` to select first when fixing it: the first one to change, or where the
 * first missing one goes.
 */
function getFirstFix(answer: string, typed: string): [start: number, end: number] {
  let start = 0;
  for (const part of alignAnswer(answer, typed)) {
    if (part.kind !== 'match') return [start, start + part.typed.length];
    start += part.typed.length;
  }
  return [start, start];
}

/**
 * Draws the retyped letters over the transparent input text: right ones as typed, ones to fix
 * marked, a tick where one is missing, then the rest of the answer as a faded guide to copy.
 */
function RetypeGuide({ answer, typed }: { answer: string; typed: string }) {
  const parts = alignAnswer(answer, typed);
  // Letters missing at the end are the rest of the answer still to type.
  const lastTyped = parts.findLastIndex(({ kind }) => kind !== 'missing');
  const rest = parts
    .slice(lastTyped + 1)
    .map(({ expected }) => expected)
    .join('');

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 flex items-center overflow-hidden border-2 border-transparent px-5 font-display text-3xl font-semibold whitespace-pre"
    >
      {parts.slice(0, lastTyped + 1).map(({ kind, typed }, index) => {
        switch (kind) {
          case 'match':
            return <span key={index}>{typed}</span>;
          case 'minor':
            return (
              <span key={index} className="rounded-sm bg-almost">
                {typed}
              </span>
            );
          case 'wrong':
          case 'extra':
            return (
              <span key={index} className="rounded-sm bg-wrong/30 text-wrong-ink">
                {typed}
              </span>
            );
          case 'missing':
            // Takes no room, so the letters stay over the input's own.
            return (
              <span key={index} className="relative">
                <span className="absolute -top-[0.45em] -left-px h-[0.9em] w-0.5 rounded-full bg-wrong-ink" />
              </span>
            );
        }
      })}
      <span className="text-muted-foreground/50">{rest}</span>
    </div>
  );
}

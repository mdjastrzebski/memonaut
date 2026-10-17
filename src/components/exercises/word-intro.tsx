import { Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  ContinueButton,
  ExerciseCard,
  PromptWord,
  type ExerciseProps,
} from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { useAutoPlay } from '@/components/exercises/use-auto-play';
import { MarkedText } from '@/components/marked-text';
import { Button } from '@/components/ui/button';
import { speak } from '@/lib/speech';

interface WordIntroProps extends ExerciseProps {
  /** Called once the word is read, to move on. */
  onDone: () => void;
}

/**
 * A new word shown before its first exercise, so it isn't first met in a guess: the word, read
 * aloud as soon as it appears, with its meaning, hint and explanation. A word with nothing to
 * translate, as in Polish spelling, shows its spoken hint instead. Nothing is rated.
 */
export function WordIntro(props: WordIntroProps) {
  const { concept, subject } = getLanguageProps(props);
  const continueRef = useRef<HTMLButtonElement>(null);
  const playWord = () => speak(concept.foreign, subject.foreignLanguage, concept.spokenHint);
  useAutoPlay(playWord);
  const meaning = concept.local ?? concept.spokenHint;

  // Focused, so Enter moves on.
  useEffect(() => continueRef.current?.focus(), []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <ExerciseCard hint={concept.hint} label="New word">
        <p className="relative mb-1 text-sm font-semibold text-muted-foreground">New word</p>
        <div className="relative mb-6 flex items-center gap-4">
          <PromptWord>{concept.foreign}</PromptWord>
          <Button
            type="button"
            variant="sticker"
            aria-label="Listen"
            className="size-12 shrink-0 rounded-2xl"
            onMouseDown={(event) => event.preventDefault()}
            onClick={playWord}
          >
            <Volume2 className="size-6" />
          </Button>
        </div>

        <div className="relative flex flex-col gap-4">
          {(meaning || concept.explanation) && (
            <div className="flex animate-rise flex-wrap items-center gap-x-2 rounded-2xl border-2 border-line bg-muted p-4 font-display text-xl font-bold break-words">
              {meaning && (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    =
                  </span>
                  <span className="sr-only">means</span>
                  <span>{meaning}</span>
                </>
              )}
              {concept.explanation && (
                <MarkedText
                  text={concept.explanation}
                  className="basis-full text-lg text-muted-foreground"
                />
              )}
            </div>
          )}
          <ContinueButton ref={continueRef} type="button" onClick={props.onDone} />
        </div>
      </ExerciseCard>
    </div>
  );
}

import { Volume2 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';

import { getClozeConcept, speakCloze } from '@/components/exercises/cloze-props';
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
import { getClozeText } from '@/exercises/cloze';
import { speak } from '@/lib/speech';

interface WordIntroProps extends ExerciseProps {
  /** Called once the word is read, to move on. */
  onDone: () => void;
  /** Shown again because it keeps being forgotten or missed, rather than as a new one. */
  tricky?: boolean;
}

/**
 * A new word or question shown with its answer before its first exercise, so it isn't first met
 * in a guess, or a tricky one after it's missed, before it's asked again. Nothing is rated.
 */
export function WordIntro(props: WordIntroProps) {
  switch (props.concept.kind) {
    case 'knowledge':
      return <QuestionIntro {...props} />;
    case 'cloze':
      return <ClozeIntro {...props} />;
    default:
      return <LanguageWordIntro {...props} />;
  }
}

/**
 * A word, read aloud as soon as it appears, with its meaning, hint and explanation. A word with
 * nothing to translate, as in Polish spelling, shows its spoken hint instead.
 */
function LanguageWordIntro(props: WordIntroProps) {
  const { concept, subject } = getLanguageProps(props);
  const playWord = () => speak(concept.foreign, subject.foreignLanguage, concept.spokenHint);
  useAutoPlay(playWord);

  return (
    <IntroCard
      label={props.tricky ? 'Tricky word' : 'New word'}
      hint={concept.hint}
      prompt={concept.foreign}
      meaning={concept.local ?? concept.spokenHint}
      explanation={concept.explanation}
      onPlay={playWord}
      onDone={props.onDone}
    />
  );
}

/** A question with its answer and explanation. Like in its exercises, it isn't read aloud. */
function QuestionIntro(props: WordIntroProps) {
  const { concept } = props;
  if (concept.kind !== 'knowledge') throw new Error('A question intro needs a question');

  return (
    <IntroCard
      label={props.tricky ? 'Tricky question' : 'New question'}
      prompt={concept.question}
      meaning={concept.answer}
      meaningLabel="answer"
      explanation={concept.explanation}
      onDone={props.onDone}
    />
  );
}

/**
 * A cloze sentence with its gap filled in and highlighted, and its hint and explanation, read
 * aloud in a language Subject.
 */
function ClozeIntro(props: WordIntroProps) {
  const concept = getClozeConcept(props);
  const playSentence = () => speakCloze(getClozeText(concept.cloze), props.subject);
  useAutoPlay(playSentence);

  return (
    <IntroCard
      label={props.tricky ? 'Tricky sentence' : 'New sentence'}
      prompt={<MarkedText text={concept.cloze} />}
      meaning={concept.hint}
      explanation={concept.explanation}
      onPlay={props.subject.kind === 'language' ? playSentence : undefined}
      onDone={props.onDone}
    />
  );
}

interface IntroCardProps {
  label: string;
  hint?: string;
  prompt: ReactNode;
  meaning?: string;
  /** Read by screen readers before the meaning. */
  meaningLabel?: string;
  explanation?: string;
  /** Reads the prompt aloud again; no Listen button without it. */
  onPlay?: () => void;
  onDone: () => void;
}

function IntroCard({
  label,
  hint,
  prompt,
  meaning,
  meaningLabel = 'means',
  explanation,
  onPlay,
  onDone,
}: IntroCardProps) {
  const continueRef = useRef<HTMLButtonElement>(null);

  // Focused, so Enter moves on.
  useEffect(() => continueRef.current?.focus(), []);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <ExerciseCard hint={hint} label={label}>
        <p className="relative mb-1 text-sm font-semibold text-muted-foreground">{label}</p>
        <div className="relative mb-6 flex items-center gap-4">
          <PromptWord>{prompt}</PromptWord>
          {onPlay && (
            <Button
              type="button"
              variant="sticker"
              aria-label="Listen"
              className="size-12 shrink-0 rounded-2xl"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onPlay}
            >
              <Volume2 className="size-6" />
            </Button>
          )}
        </div>

        <div className="relative flex flex-col gap-4">
          {(meaning || explanation) && (
            <div className="flex animate-rise flex-wrap items-center gap-x-2 rounded-2xl border-2 border-line bg-muted p-4 font-display text-xl font-bold break-words">
              {meaning && (
                <>
                  <span aria-hidden className="text-muted-foreground">
                    =
                  </span>
                  <span className="sr-only">{meaningLabel}</span>
                  <span>{meaning}</span>
                </>
              )}
              {explanation && (
                <MarkedText
                  text={explanation}
                  className="basis-full text-lg text-muted-foreground"
                />
              )}
            </div>
          )}
          <ContinueButton ref={continueRef} type="button" onClick={onDone} />
        </div>
      </ExerciseCard>
    </div>
  );
}

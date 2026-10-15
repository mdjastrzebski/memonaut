import { Volume2 } from 'lucide-react';

import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { TypedExercise } from '@/components/exercises/typed-exercise';
import { useAutoPlay } from '@/components/exercises/use-auto-play';
import { Button } from '@/components/ui/button';
import { speak } from '@/lib/speech';

/**
 * Dictation: the learner hears the foreign word, read aloud as soon as the exercise appears, and
 * types how it's spelled. A spoken hint follows the word to tell it apart from words that sound the
 * same. Its hint isn't shown, as one like "3" would give the word away.
 */
export function DictationExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const playWord = () => speak(concept.foreign, subject.foreignLanguage, concept.spokenHint);
  useAutoPlay(playWord);

  return (
    <TypedExercise
      {...props}
      answer={concept.foreign}
      meaning={concept.local ?? concept.spokenHint}
      explanation={concept.explanation}
      prompt={
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
      }
    />
  );
}

import { Volume2 } from 'lucide-react';

import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { useAutoPlay } from '@/components/exercises/use-auto-play';
import { Button } from '@/components/ui/button';
import { speak } from '@/lib/speech';

/**
 * Recognition: the learner sees and hears the foreign word, read aloud as soon as the exercise
 * appears, and picks the local one. Its hint isn't shown, as one like "3" would give the meaning
 * away.
 */
export function RecognitionChoiceExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const playWord = () => speak(concept.foreign, subject.foreignLanguage);
  useAutoPlay(playWord);

  return (
    <ChoiceExercise
      {...props}
      concept={concept}
      side="local"
      question="What does it mean?"
      prompt={
        <>
          <PromptWord>{concept.foreign}</PromptWord>
          <Button
            type="button"
            variant="sticker"
            aria-label="Listen"
            className="size-12 shrink-0 rounded-2xl"
            onClick={playWord}
          >
            <Volume2 className="size-6" />
          </Button>
        </>
      }
      onListen={playWord}
    />
  );
}

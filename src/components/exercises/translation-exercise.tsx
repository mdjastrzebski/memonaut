import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { TypedExercise } from '@/components/exercises/typed-exercise';
import { speak } from '@/lib/speech';

/**
 * Translation: the learner sees the local word and types the foreign one, then hears it once
 * they've typed it.
 */
export function TranslationExercise(props: ExerciseProps) {
  const { concept, subject } = props;

  return (
    <TypedExercise
      {...props}
      hint={concept.hint}
      prompt={<PromptWord>{concept.local}</PromptWord>}
      onChecked={() => speak(concept.foreign, subject.foreignLanguage)}
    />
  );
}

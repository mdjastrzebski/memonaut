import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { TypedExercise } from '@/components/exercises/typed-exercise';
import { speak } from '@/lib/speech';

/**
 * Translation: the learner sees the local word and types the foreign one, then hears it once
 * they've typed it, unless the Subject doesn't read answers aloud.
 */
export function TranslationExercise(props: ExerciseProps) {
  const { concept, subject } = props;

  return (
    <TypedExercise
      {...props}
      hint={concept.hint}
      prompt={<PromptWord>{concept.local}</PromptWord>}
      onChecked={
        subject.readAloud ? () => speak(concept.foreign, subject.foreignLanguage) : undefined
      }
    />
  );
}

import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { speak } from '@/lib/speech';

/**
 * Translation choice: the learner sees the local word and picks the foreign one, then hears it once
 * they've picked, unless the Subject doesn't read answers aloud.
 */
export function TranslationChoiceExercise(props: ExerciseProps) {
  const { concept, subject } = props;
  const playWord = subject.readAloud
    ? () => speak(concept.foreign, subject.foreignLanguage)
    : undefined;

  return (
    <ChoiceExercise
      {...props}
      side="foreign"
      question="Which word is it?"
      hint={concept.hint}
      prompt={<PromptWord>{concept.local}</PromptWord>}
      onListen={playWord}
      onPicked={playWord}
    />
  );
}

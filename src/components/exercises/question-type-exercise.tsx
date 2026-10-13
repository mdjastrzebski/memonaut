import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { TypedExercise } from '@/components/exercises/typed-exercise';

/** Question type: the learner sees a knowledge question, e.g. "3² =", and types its answer. */
export function QuestionTypeExercise(props: ExerciseProps) {
  const { card, concept } = props;
  if (concept.kind !== 'knowledge') {
    throw new Error(`${card.exerciseType} needs a knowledge subject`);
  }

  return (
    <TypedExercise
      {...props}
      prompt={<PromptWord>{concept.question}</PromptWord>}
      answer={concept.answer}
      explanation={concept.explanation}
    />
  );
}

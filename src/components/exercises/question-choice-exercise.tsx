import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { MarkedText } from '@/components/marked-text';
import { shuffle } from '@/lib/shuffle';

/**
 * Question choice: the learner sees a knowledge question, e.g. "2 · 3² =", and picks its answer
 * from it and the question's own wrong choices, e.g. common mistakes like "36".
 */
export function QuestionChoiceExercise(props: ExerciseProps) {
  const { card, concept } = props;
  if (concept.kind !== 'knowledge' || !concept.choices) {
    throw new Error(`${card.exerciseType} needs a knowledge question with choices`);
  }
  const { answer, choices } = concept;

  return (
    <ChoiceExercise
      {...props}
      question="Which is the answer?"
      prompt={<PromptWord>{concept.question}</PromptWord>}
      answer={answer}
      pickOptions={() => shuffle([answer, ...choices])}
      feedback={concept.explanation ? <MarkedText text={concept.explanation} /> : answer}
    />
  );
}

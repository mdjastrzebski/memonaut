import { ChoiceExercise, type ChoiceExerciseProps } from '@/components/exercises/choice-exercise';
import { getLanguageProps } from '@/components/exercises/language-props';
import { MarkedText } from '@/components/marked-text';
import type { LanguageConcept } from '@/domain/types';
import { pickChoices, type ChoiceSide } from '@/exercises/multiple-choice';

interface WordChoiceExerciseProps extends Omit<
  ChoiceExerciseProps,
  'answer' | 'pickOptions' | 'feedback'
> {
  /** The word offered as options: local in recognition, foreign in translation. */
  side: ChoiceSide;
}

/** Multiple choice over a language Subject's words: the other options are other words. */
export function WordChoiceExercise({ side, ...props }: WordChoiceExerciseProps) {
  const { session, subjectConcepts } = props;
  const { concept } = getLanguageProps(props);

  const pickOptions = () => {
    const words = subjectConcepts.filter(
      (other): other is LanguageConcept => other.kind === 'language',
    );
    return pickChoices(concept, {
      side,
      deckConcepts: words.filter((other) => session.deck.conceptIds.includes(other.id)),
      subjectConcepts: words,
    });
  };

  return (
    <ChoiceExercise
      {...props}
      answer={concept[side]!}
      pickOptions={pickOptions}
      feedback={<WordFeedback concept={concept} />}
    />
  );
}

/** A word and its meaning, with its explanation, shown with the result. */
function WordFeedback({ concept }: { concept: LanguageConcept }) {
  return (
    <>
      <span>{concept.foreign}</span>
      <span aria-hidden className="text-muted-foreground">
        =
      </span>
      <span className="sr-only">means</span>
      <span>{concept.local}</span>
      {concept.explanation && (
        <MarkedText
          text={concept.explanation}
          className="basis-full text-lg text-muted-foreground"
        />
      )}
    </>
  );
}

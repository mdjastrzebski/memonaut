import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { TypedExercise } from '@/components/exercises/typed-exercise';
import { getPluralExplanation } from '@/exercises/plurals';
import { speak } from '@/lib/speech';

/** Says that the plural is asked for, below the prompt. */
function PluralLabel() {
  return <p className="mt-1 font-semibold text-muted-foreground">Plural</p>;
}

/**
 * Plural form: the learner sees the foreign word, e.g. "das Buch", and types its plural, "die
 * Bücher", then hears it. The result shows how the plural is made.
 */
export function PluralFormExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const plural = concept.foreignPlural!;

  return (
    <TypedExercise
      {...props}
      prompt={
        <>
          <PromptWord>{concept.foreign}</PromptWord>
          <PluralLabel />
        </>
      }
      answer={plural}
      meaning={concept.localPlural ?? concept.local}
      explanation={getPluralExplanation(concept.foreign, plural)}
      onChecked={() => speak(plural, subject.foreignLanguage)}
    />
  );
}

/**
 * Translation plural: the learner sees the local plural, e.g. "książki", and types the foreign one,
 * "die Bücher", then hears it. The result shows how the plural is made.
 */
export function TranslationPluralExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const plural = concept.foreignPlural!;

  return (
    <TypedExercise
      {...props}
      prompt={
        <>
          <PromptWord>{concept.localPlural}</PromptWord>
          <PluralLabel />
        </>
      }
      answer={plural}
      meaning={concept.localPlural}
      explanation={getPluralExplanation(concept.foreign, plural)}
      onChecked={() => speak(plural, subject.foreignLanguage)}
    />
  );
}

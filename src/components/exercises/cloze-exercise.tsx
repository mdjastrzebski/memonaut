import { getClozeConcept, speakCloze } from '@/components/exercises/cloze-props';
import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import { TypedExercise } from '@/components/exercises/typed-exercise';
import { fillCloze, splitCloze } from '@/exercises/cloze';

/**
 * Cloze: the learner sees a sentence with a gap, e.g. "das ist der Rucksack ___", and its hint, and
 * types what's missing, "von Julian", then hears the whole sentence. A one-word gap is easy to get
 * wrong by one letter, e.g. "den" for "der", so then only wrong capitalization is forgiven. The
 * result shows the sentence with the gap filled in and highlighted.
 */
export function ClozeExercise(props: ExerciseProps) {
  const concept = getClozeConcept(props);
  const parts = splitCloze(concept.cloze)!;
  const { before, gap, after } = parts;

  return (
    <TypedExercise
      {...props}
      prompt={
        <>
          <h2 className="min-w-0 font-display text-3xl font-extrabold tracking-tight break-words whitespace-pre-wrap sm:text-4xl">
            {before}
            <span
              aria-label="gap"
              className="mx-1 inline-block w-[3ch] border-b-4 border-rocket align-baseline"
            >
              &nbsp;
            </span>
            {after}
          </h2>
          {concept.hint && (
            <p className="mt-2 font-semibold text-muted-foreground">{concept.hint}</p>
          )}
        </>
      }
      answer={gap}
      strict={!/\s/.test(gap)}
      explanation={concept.explanation ?? concept.cloze}
      onChecked={() => speakCloze(fillCloze(parts), props.subject)}
    />
  );
}

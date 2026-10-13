import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import type { LangConcept, LangSubject } from '@/domain/types';

/** The Card's word and the language it's in, for the Exercise Types of a language Subject. */
export function getLangProps({ card, concept, subject }: ExerciseProps): {
  concept: LangConcept;
  subject: LangSubject;
} {
  if (concept.kind !== 'lang' || subject.kind !== 'lang') {
    throw new Error(`${card.exerciseType} needs a language subject`);
  }
  return { concept, subject };
}

import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import type { LanguageConcept, LanguageSubject } from '@/domain/types';

/** The Card's word and the language it's in, for the Exercise Types of a language Subject. */
export function getLanguageProps({ card, concept, subject }: ExerciseProps): {
  concept: LanguageConcept;
  subject: LanguageSubject;
} {
  if (concept.kind !== 'language' || subject.kind !== 'language') {
    throw new Error(`${card.exerciseType} needs a language subject`);
  }
  return { concept, subject };
}

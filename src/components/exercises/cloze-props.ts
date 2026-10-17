import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import type { ClozeConcept, Subject } from '@/domain/types';
import { speak } from '@/lib/speech';

/** The Card's cloze sentence. */
export function getClozeConcept({ card, concept }: ExerciseProps): ClozeConcept {
  if (concept.kind !== 'cloze') throw new Error(`${card.exerciseType} needs a cloze sentence`);
  return concept;
}

/** Reads a cloze sentence aloud in a language Subject; a knowledge Subject's aren't. */
export function speakCloze(text: string, subject: Subject) {
  if (subject.kind === 'language') speak(text, subject.foreignLanguage);
}

import type { Concept, SubjectKind } from '@/domain/types';

/** What a Concept asks, e.g. the local word or the question, and its answer, e.g. the foreign word. */
export function getConceptText(concept: Concept): { prompt?: string; answer: string } {
  return concept.kind === 'language'
    ? { prompt: concept.local, answer: concept.foreign }
    : { prompt: concept.question, answer: concept.answer };
}

/** What the Concepts of each kind of Subject are called. */
export const CONCEPT_NOUNS: Record<SubjectKind, { one: string; many: string; Many: string }> = {
  language: { one: 'word', many: 'words', Many: 'Words' },
  knowledge: { one: 'question', many: 'questions', Many: 'Questions' },
};

export type ConceptNoun = (typeof CONCEPT_NOUNS)[SubjectKind];

export function plural(count: number, noun: ConceptNoun | string): string {
  if (typeof noun === 'string') return `${count} ${noun}${count === 1 ? '' : 's'}`;
  return `${count} ${count === 1 ? noun.one : noun.many}`;
}

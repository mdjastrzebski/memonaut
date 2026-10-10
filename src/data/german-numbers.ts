import type { Concept, Deck, Subject } from '@/domain/types';

export const german: Subject = { id: 'german', name: 'German' };

const numbers: [hint: string, prompt: string, answer: string][] = [
  ['0', 'zero', 'null'],
  ['1', 'one', 'eins'],
  ['2', 'two', 'zwei'],
  ['3', 'three', 'drei'],
  ['4', 'four', 'vier'],
  ['5', 'five', 'fünf'],
  ['6', 'six', 'sechs'],
  ['7', 'seven', 'sieben'],
  ['8', 'eight', 'acht'],
  ['9', 'nine', 'neun'],
  ['10', 'ten', 'zehn'],
];

export const germanNumberConcepts: Concept[] = numbers.map(([hint, prompt, answer]) => ({
  id: `german-number-${hint}`,
  subjectId: german.id,
  prompt,
  answer,
  hint,
}));

export const germanNumbersDeck: Deck = {
  id: 'german-numbers-0-10',
  subjectId: german.id,
  kind: 'unit',
  name: 'Numbers 0–10',
  conceptIds: germanNumberConcepts.map((concept) => concept.id),
};

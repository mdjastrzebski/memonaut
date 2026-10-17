import { describe, expect, it } from 'vitest';

import { getPluralExplanation } from '@/exercises/plurals';

describe('getPluralExplanation', () => {
  it.each([
    ['der Kuli', 'die Kulis', 'der Kuli → die Kuli[s]'],
    ['die Lampe', 'die Lampen', 'die Lampe → die Lampe[n]'],
    ['der Bleistift', 'die Bleistifte', 'der Bleistift → die Bleistift[e]'],
    ['die Lehrerin', 'die Lehrerinnen', 'die Lehrerin → die Lehrerin[nen]'],
    ['das Buch', 'die Bücher', 'das Buch → die B[ü]ch[er]'],
    ['der Rucksack', 'die Rucksäcke', 'der Rucksack → die Rucks[ä]ck[e]'],
    ['das Taschentuch', 'die Taschentücher', 'das Taschentuch → die Taschent[ü]ch[er]'],
    ['der Computer', 'die Computer', 'der Computer → [die] Computer'],
    ['child', 'children', 'child → child[ren]'],
    ['mouse', 'mice', 'mouse → m[ic]e'],
  ])('marks what %s → %s adds', (singular, plural, explanation) => {
    expect(getPluralExplanation(singular, plural)).toBe(explanation);
  });
});

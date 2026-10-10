import { expect, test } from 'vitest';

import type { Deck } from '@/domain/types';

import { getSubjectDecks } from './decks';

function deck(id: string, kind: Deck['kind'], conceptIds: string[], subjectId = 'german'): Deck {
  return { id, subjectId, kind, name: id, conceptIds };
}

const animals = deck('animals', 'unit', ['hund', 'katze', 'maus']);
const food = deck('food', 'unit', ['brot', 'wasser']);
const core = deck('core', 'core', ['hund', 'katze', 'wasser', 'ja']);
const english = deck('colours', 'unit', ['red'], 'english');
const decks = [animals, food, core, english];

test('lists core decks first, then units in their original order', () => {
  expect(getSubjectDecks(decks, 'german')).toEqual([core, animals, food]);
  expect(getSubjectDecks(decks, 'english')).toEqual([english]);
});

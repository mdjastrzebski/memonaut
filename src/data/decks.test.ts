import { expect, test } from 'vitest';

import type { Deck } from '@/domain/types';

import { getDeckStats, getSubjectDecks } from './decks';

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

test('counts concepts shared with the core deck and those only in a unit', () => {
  expect(getDeckStats(animals, decks)).toEqual({
    conceptCount: 3,
    overlaps: [{ deck: core, count: 2 }],
    exclusiveCount: 1,
  });
});

test('counts how much of the core deck comes from each unit', () => {
  expect(getDeckStats(core, decks)).toEqual({
    conceptCount: 4,
    overlaps: [
      { deck: animals, count: 2 },
      { deck: food, count: 1 },
    ],
    exclusiveCount: 1,
  });
});

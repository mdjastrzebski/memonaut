import { expect, test } from 'vitest';

import { content } from '@/data/content';

import { loadSetupChoice, saveSetupChoice } from './setup-choice';

const deck = (id: string) => content.decks.find((deck) => deck.id === id)!;
const save = (value: unknown) => localStorage.setItem('memonaut:setup', JSON.stringify(value));

test('loads the saved set, session size and last unit of each subject', () => {
  const lastUnitIds = { german: 'german/kapitel-0' };
  saveSetupChoice({ deck: deck('german/core'), sessionSize: null, lastUnitIds });
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('german/core'),
    sessionSize: null,
    lastUnitIds,
  });
});

test('falls back to the first subject with 10 words when nothing is saved', () => {
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('english/core'),
    sessionSize: 10,
    lastUnitIds: {},
  });
});

test("falls back to the subject's core set when the saved set is gone", () => {
  save({ subjectId: 'german', deckId: 'german/kapitel-99', sessionSize: 5 });
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('german/core'),
    sessionSize: 5,
    lastUnitIds: {},
  });
});

test('forgets last units that are gone or not units of their subject', () => {
  save({
    lastUnitIds: {
      german: 'german/kapitel-99',
      english: 'english/core',
      french: 'german/kapitel-0',
    },
  });
  expect(loadSetupChoice(content).lastUnitIds).toEqual({});
});

test('ignores a session size that is no longer offered, and unreadable data', () => {
  save({ deckId: 'german/kapitel-0', sessionSize: 7 });
  expect(loadSetupChoice(content).sessionSize).toBe(10);

  localStorage.setItem('memonaut:setup', '{oops');
  expect(loadSetupChoice(content).deck).toEqual(deck('english/core'));
});

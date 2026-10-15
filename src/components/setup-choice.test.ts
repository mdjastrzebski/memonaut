import { expect, test } from 'vitest';

import { content } from '@/data/content';

import { loadSetupChoice, saveSetupChoice } from './setup-choice';

const deck = (id: string) => content.decks.find((deck) => deck.id === id)!;
const save = (value: unknown) => localStorage.setItem('memonaut:setup', JSON.stringify(value));

test('loads the saved set, session length and last unit of each subject', () => {
  const lastUnitIds = { german: 'german/kapitel-0' };
  saveSetupChoice({ deck: deck('german/core'), sessionMinutes: 20, lastUnitIds });
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('german/core'),
    sessionMinutes: 20,
    lastUnitIds,
  });
});

test('falls back to the first subject with 10 minutes when nothing is saved', () => {
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('english/core'),
    sessionMinutes: 10,
    lastUnitIds: {},
  });
});

test("falls back to the subject's core set when the saved set is gone", () => {
  save({ subjectId: 'german', deckId: 'german/kapitel-99', sessionMinutes: 15 });
  expect(loadSetupChoice(content)).toEqual({
    deck: deck('german/core'),
    sessionMinutes: 15,
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

test('ignores a session length that is not offered, and unreadable data', () => {
  save({ deckId: 'german/kapitel-0', sessionMinutes: 7 });
  expect(loadSetupChoice(content).sessionMinutes).toBe(10);
  // Sessions used to count exercises; 20 exercises isn't read as 20 minutes.
  save({ deckId: 'german/kapitel-0', sessionSize: 20 });
  expect(loadSetupChoice(content).sessionMinutes).toBe(10);

  localStorage.setItem('memonaut:setup', '{oops');
  expect(loadSetupChoice(content).deck).toEqual(deck('english/core'));
});

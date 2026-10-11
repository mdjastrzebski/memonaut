import { expect, test } from 'vitest';

import type { Concept } from '@/domain/types';
import { Rating } from '@/srs/scheduler';

import { getChoiceSide, gradeChoice, pickChoices } from './multiple-choice';

const concept = (id: string, local: string, foreign: string): Concept => ({
  id,
  subjectId: 'german',
  local,
  foreign,
});

const eins = concept('1', 'jeden', 'eins');
const zwei = concept('2', 'dwa', 'zwei');
const drei = concept('3', 'trzy', 'drei');
const vier = concept('4', 'cztery', 'vier');
const fuenf = concept('5', 'pięć', 'fünf');
const hund = concept('hund', 'pies', 'der Hund');

test('offers the answer and wrong options from the deck', () => {
  const options = pickChoices(eins, {
    side: 'foreign',
    deckConcepts: [eins, zwei, drei, vier, fuenf],
    subjectConcepts: [hund],
  });
  expect(options).toHaveLength(4);
  expect(options).toContain('eins');
  expect(options).not.toContain('der Hund');
  expect(new Set(options).size).toBe(4);
});

test('offers the local words in recognition', () => {
  const options = pickChoices(eins, {
    side: 'local',
    deckConcepts: [eins, zwei, drei, vier],
    subjectConcepts: [],
  });
  expect(options.toSorted()).toEqual(['cztery', 'dwa', 'jeden', 'trzy']);
});

test('fills up from the subject when the deck is small, or offers fewer', () => {
  const fromSubject = pickChoices(eins, {
    side: 'foreign',
    deckConcepts: [eins, zwei],
    subjectConcepts: [eins, zwei, hund],
  });
  expect(fromSubject.toSorted()).toEqual(['der Hund', 'eins', 'zwei']);
});

test('leaves out concepts that would be right too, and repeated words', () => {
  const large = concept('large', 'duży', 'large');
  const big = concept('big', 'duży', 'big');
  const bigToo = concept('big-2', 'wielki', 'Big');
  const small = concept('small', 'mały', 'small');
  const options = pickChoices(big, {
    side: 'foreign',
    deckConcepts: [big, large, bigToo, small],
    subjectConcepts: [],
  });
  expect(options.toSorted()).toEqual(['big', 'small']);
});

test('offers others of the group first, from the subject too, then fills up from the deck', () => {
  const day = (id: string, local: string) => ({ ...concept(id, local, id), group: 'weekday' });
  const monday = day('Monday', 'poniedziałek');
  const tuesday = day('Tuesday', 'wtorek');
  const sunday = day('Sunday', 'niedziela');
  const winter = { ...concept('winter', 'zima', 'winter'), group: 'season' };
  const pick = (deckConcepts: Concept[], subjectConcepts: Concept[]) =>
    pickChoices(monday, { side: 'foreign', deckConcepts, subjectConcepts }).toSorted();

  expect(pick([monday, tuesday, winter, eins, zwei, drei], [sunday])).toEqual([
    'Monday',
    'Sunday',
    'Tuesday',
    expect.stringMatching(/^(winter|eins|zwei|drei)$/),
  ]);
  const options = pick([monday, tuesday, sunday, winter, eins, zwei, drei], []);
  expect(options).toContain('Tuesday');
  expect(options).toContain('Sunday');
});

test('fills up from the wider group before the rest of the deck', () => {
  const number = (id: string, group: string) => ({ ...concept(id, id, id), group });
  const one = number('one', 'number/small');
  const two = number('two', 'number/small');
  const twelve = number('twelve', 'number/teens');
  const thirty = number('thirty', 'number/tens/round');
  const options = pickChoices(one, {
    side: 'foreign',
    deckConcepts: [one, two, hund, zwei, drei, vier],
    subjectConcepts: [twelve, thirty],
  });
  expect(options.toSorted()).toEqual(['one', 'thirty', 'twelve', 'two']);
});

test('a wider group is one followed by a slash, not any group starting the same', () => {
  const one = { ...concept('one', 'jeden', 'one'), group: 'number/small' };
  const dozen = { ...concept('dozen', 'tuzin', 'dozen'), group: 'numbers' };
  const twelve = { ...concept('twelve', 'dwanaście', 'twelve'), group: 'number/teens' };
  const options = pickChoices(one, {
    side: 'foreign',
    deckConcepts: [one, dozen],
    subjectConcepts: [twelve],
    count: 2,
  });
  expect(options.toSorted()).toEqual(['one', 'twelve']);
});

test('shuffles the options', () => {
  const pick = (random: () => number) =>
    pickChoices(eins, {
      side: 'foreign',
      deckConcepts: [eins, zwei, drei, vier],
      subjectConcepts: [],
      random,
    });
  expect(pick(() => 0)).not.toEqual(pick(() => 0.99));
});

test('rates a right pick Good and a wrong one Again', () => {
  expect(gradeChoice('eins', 'eins', 500).grade).toBe(Rating.Good);
  expect(gradeChoice('eins', 'zwei', 500).grade).toBe(Rating.Again);
});

test('knows which word each choice exercise offers', () => {
  expect(getChoiceSide('recognition-choice')).toBe('local');
  expect(getChoiceSide('translation-choice')).toBe('foreign');
  expect(getChoiceSide('dictation')).toBeUndefined();
});

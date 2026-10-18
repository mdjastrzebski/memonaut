import { expect, test } from 'vitest';

import type { Concept, Deck } from '@/domain/types';
import { Rating, type Grade } from '@/srs/scheduler';

import { createSession, getCurrentIntro, introduce, submitReview } from './session';
import { getAnswerXp, getSessionXp } from './xp';

const concepts: Concept[] = [
  { id: 'one', subjectId: 'german', kind: 'language', local: 'jeden', foreign: 'eins' },
  { id: 'two', subjectId: 'german', kind: 'language', local: 'dwa', foreign: 'zwei' },
];
const deck: Deck = {
  id: 'numbers',
  subjectId: 'german',
  kind: 'unit',
  name: 'Numbers',
  conceptIds: ['one', 'two'],
  exerciseTypes: ['translation'],
};
const now = new Date('2026-01-01T10:00:00Z');

test('a right answer earns its exercise type effort points, a fast one twice as many', () => {
  expect(getAnswerXp('recognition-choice', Rating.Good)).toBe(1);
  expect(getAnswerXp('recognition-choice', Rating.Easy)).toBe(2);
  expect(getAnswerXp('cloze', Rating.Good)).toBe(1.5);
  expect(getAnswerXp('translation', Rating.Easy)).toBe(5);
});

test('an almost right or missed answer earns nothing', () => {
  expect(getAnswerXp('translation', Rating.Hard)).toBe(0);
  expect(getAnswerXp('translation', Rating.Again)).toBe(0);
});

test('a session adds up its answers', () => {
  let session = createSession({ deck: { ...deck, showIntro: false }, concepts, now });
  expect(getSessionXp(session)).toBe(0);
  for (const rating of [Rating.Easy, Rating.Hard] as Grade[]) {
    session = submitReview(session, { input: '', elapsedMs: 1000, rating, issues: [], now });
  }
  expect(getSessionXp(session)).toBe(5);
});

test('a fast answer right after the intro earns double, though it counts as Good', () => {
  let session = createSession({ deck, concepts, now });
  while (getCurrentIntro(session)) session = introduce(session);
  session = submitReview(session, {
    input: '',
    elapsedMs: 1000,
    rating: Rating.Easy,
    issues: [],
    now,
  });
  expect(session.reviews[0]).toMatchObject({ rating: Rating.Good, earnedRating: Rating.Easy });
  expect(getSessionXp(session)).toBe(5);
});

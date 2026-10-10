import { expect, test } from 'vitest';

import type { Concept, Deck } from '@/domain/types';
import { Rating, State } from '@/srs/scheduler';

import { createSession, getCurrentCard, submitReview } from './session';

const concepts: Concept[] = [
  { id: 'one', subjectId: 'german', prompt: 'one', answer: 'eins' },
  { id: 'two', subjectId: 'german', prompt: 'two', answer: 'zwei' },
];
const deck: Deck = {
  id: 'numbers',
  subjectId: 'german',
  kind: 'unit',
  name: 'Numbers',
  conceptIds: ['one', 'two'],
};
const start = new Date('2026-01-01T10:00:00Z');
const minutes = (n: number) => new Date(start.getTime() + n * 60_000);

function create() {
  return createSession({ deck, concepts, now: start, random: () => 0.99 });
}

test('creates one new card per concept and exercise type', () => {
  const session = create();
  expect(Object.keys(session.cards)).toEqual(['one:type-answer', 'two:type-answer']);
  expect(Object.values(session.cards).every((card) => card.srs.state === State.New)).toBe(true);
  expect(session.queue).toHaveLength(2);
});

test('learning card returns to the end of the queue', () => {
  let session = create();
  const first = getCurrentCard(session)!;

  session = submitReview(session, {
    input: 'x',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Again,
    now: start,
  });

  expect(session.cards[first.id].srs.state).toBe(State.Learning);
  expect(session.queue).toEqual([expect.not.stringMatching(first.id), first.id]);
  expect(session.reviews).toHaveLength(1);
  expect(session.reviews[0].log.state).toBe(State.New);
});

test('card leaves the session once it graduates to review', () => {
  let session = create();
  const first = getCurrentCard(session)!;

  // New → Learning (10m step), then Learning → Review (days).
  session = submitReview(session, {
    input: 'a',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Good,
    now: start,
  });
  session = submitReview(session, {
    input: 'b',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Easy,
    now: start,
  });
  session = submitReview(session, {
    input: 'a',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Good,
    now: minutes(1),
  });

  expect(session.cards[first.id].srs.state).toBe(State.Review);
  expect(session.queue).not.toContain(first.id);
  expect(session.queue).toHaveLength(0);
});

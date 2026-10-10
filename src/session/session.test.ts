import { expect, test } from 'vitest';

import type { Concept, Deck } from '@/domain/types';
import { Rating, State, type Grade } from '@/srs/scheduler';

import { createSession, getCurrentCard, getSessionProgress, submitReview } from './session';

const concepts: Concept[] = [
  { id: 'one', subjectId: 'german', local: 'jeden', foreign: 'eins' },
  { id: 'two', subjectId: 'german', local: 'dwa', foreign: 'zwei' },
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
  return createSession({
    deck,
    concepts,
    exerciseTypes: ['translation'],
    now: start,
    random: () => 0.99,
  });
}

test('creates one new card per concept and exercise type', () => {
  const session = createSession({ deck, concepts, now: start });
  expect(Object.keys(session.cards)).toEqual([
    'one:dictation',
    'two:dictation',
    'one:translation',
    'two:translation',
  ]);
  expect(Object.values(session.cards).every((card) => card.srs.state === State.New)).toBe(true);
});

test('keeps the review state of cards practised in an earlier session', () => {
  const earlier = submitReview(create(), {
    input: 'x',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Again,
    now: start,
  });
  const [practised] = earlier.queue.slice(-1);

  const session = createSession({ deck, concepts, cards: earlier.cards, now: minutes(30) });
  expect(session.cards[practised]).toBe(earlier.cards[practised]);
  expect(session.cards['one:dictation'].srs.state).toBe(State.New);
});

test('queues every dictation card before the translation cards', () => {
  for (const value of [0, 0.5, 0.99]) {
    const session = createSession({ deck, concepts, now: start, random: () => value });
    expect(session.queue.map((id) => session.cards[id].exerciseType)).toEqual([
      'dictation',
      'dictation',
      'translation',
      'translation',
    ]);
  }
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

test('progress counts answered cards half and finished cards fully', () => {
  let session = create();
  expect(getSessionProgress(session)).toBe(0);

  const review = (rating: Grade) =>
    (session = submitReview(session, {
      input: 'x',
      elapsedMs: 1000,
      issues: [],
      rating,
      now: start,
    }));

  // Answered but still queued.
  review(Rating.Again);
  expect(getSessionProgress(session)).toBe(0.25);

  // Easy on a new card graduates it straight to review.
  review(Rating.Easy);
  expect(getSessionProgress(session)).toBe(0.75);
});

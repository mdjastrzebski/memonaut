import { expect, test } from 'vitest';

import type { Card, Concept, Deck, ExerciseType } from '@/domain/types';
import {
  createSrsCard,
  Rating,
  reviewSrsCard,
  State,
  type FsrsCard,
  type Grade,
} from '@/srs/scheduler';

import {
  countDueToday,
  createSession,
  getCurrentCard,
  getSessionProgress,
  submitReview,
} from './session';

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
  exerciseTypes: ['dictation', 'translation'],
};
const start = new Date('2026-01-01T10:00:00Z');
const minutes = (n: number) => new Date(start.getTime() + n * 60_000);

function create() {
  return createSession({
    deck: { ...deck, exerciseTypes: ['translation'] },
    concepts,
    now: start,
    random: () => 0.99,
  });
}

/** A Card answered Easy at `at`, so it graduated to Review, with any SRS state overridden. */
function reviewed(id: string, at: Date, srs: Partial<FsrsCard> = {}): Card {
  const [conceptId, exerciseType] = id.split(':') as [string, ExerciseType];
  const { card } = reviewSrsCard(createSrsCard(at), Rating.Easy, at);
  return { id, conceptId, exerciseType, srs: { ...card, ...srs } };
}

function byId(...cards: Card[]): Record<string, Card> {
  return Object.fromEntries(cards.map((card) => [card.id, card]));
}

/** The ids of the Cards a session picks, grouped by Exercise Type. */
function pick(cards: Record<string, Card>, now: Date, maxCards?: number, sessionDeck = deck) {
  return Object.keys(createSession({ deck: sessionDeck, concepts, cards, maxCards, now }).cards);
}

const nextDay = (date: Date) => new Date(date.getTime() + 24 * 60 * 60_000);

test('starts a new concept with its first exercise type only', () => {
  const session = createSession({ deck, concepts, now: start });
  expect(Object.keys(session.concepts)).toEqual(['one', 'two']);
  expect(Object.keys(session.cards)).toEqual(['one:dictation', 'two:dictation']);
  expect(Object.values(session.cards).every((card) => card.srs.state === State.New)).toBe(true);
});

test('practises at most the given number of cards', () => {
  expect(pick({}, start, 1)).toEqual(['one:dictation']);
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
});

test('unlocks the next exercise type once the previous card graduates', () => {
  // Still learning: translation stays locked.
  const learning = byId({
    ...reviewed('one:dictation', start),
    srs: reviewSrsCard(createSrsCard(start), Rating.Good, start).card,
  });
  expect(pick(learning, nextDay(start))).toEqual(['one:dictation', 'two:dictation']);

  // Graduated: on the next day, translation comes before the new word.
  const graduated = byId(reviewed('one:dictation', start));
  expect(pick(graduated, nextDay(start), 1)).toEqual(['one:translation']);
});

test('holds back other exercise types of a word practised today, using them only to fill room', () => {
  const cards = byId(reviewed('one:dictation', start));
  // New words come first.
  expect(pick(cards, minutes(30), 1)).toEqual(['two:dictation']);
  // With room left, the held-back translation joins.
  expect(pick(cards, minutes(30), 2)).toEqual(['two:dictation', 'one:translation']);
});

test('a study day starts at 4 AM local time', () => {
  const lateEvening = new Date(2026, 0, 1, 23, 30);
  const cards = byId(reviewed('one:dictation', lateEvening));
  // Past midnight is still the same study day, so the new word comes first.
  expect(pick(cards, new Date(2026, 0, 2, 0, 15), 1)).toEqual(['two:dictation']);
  expect(pick(cards, new Date(2026, 0, 2, 4, 15), 1)).toEqual(['one:translation']);
});

test('practises the due type most likely forgotten, holding the other back', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  const cards = byId(
    reviewed('one:dictation', lastWeek, { stability: 30, due: start }),
    reviewed('one:translation', lastWeek, { stability: 3, due: start }),
  );
  expect(pick(cards, start, 1)).toEqual(['one:translation']);
  // The new word comes before the held-back dictation.
  expect(pick(cards, start, 2)).toEqual(['two:dictation', 'one:translation']);
  expect(pick(cards, start, 3)).toEqual(['two:dictation', 'one:dictation', 'one:translation']);
});

test('keeps every exercise type already started, picking due ones first', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  // Started before exercise types were unlocked one at a time.
  const cards = byId(
    reviewed('two:dictation', lastWeek, { due: nextDay(start) }),
    reviewed('two:translation', lastWeek, { due: start }),
  );
  expect(pick(cards, start, 1)).toEqual(['two:translation']);
});

test('picks new concepts in deck order, or shuffled for a deck with shuffleNew', () => {
  const pickNew = (deck: Deck) =>
    Object.keys(
      createSession({ deck, concepts, maxCards: 1, now: start, random: () => 0 }).concepts,
    );
  expect(pickNew(deck)).toEqual(['one']);
  expect(pickNew({ ...deck, shuffleNew: true })).toEqual(['two']);
});

test('reviews ahead with the room left, queuing every dictation before the translations', () => {
  const cards = byId(reviewed('one:dictation', start), reviewed('two:dictation', start));
  for (const value of [0, 0.5, 0.99]) {
    const session = createSession({
      deck,
      concepts,
      cards,
      now: nextDay(start),
      random: () => value,
    });
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

test('counts words due before the next study day, or with an exercise type unlocked', () => {
  const yesterday = new Date(2026, 0, 1, 8);
  const morning = new Date(2026, 0, 2, 8);
  const cards = byId(
    // Due tonight.
    reviewed('one:dictation', yesterday, { due: new Date(2026, 0, 2, 23) }),
    reviewed('one:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Translation unlocked.
    reviewed('two:dictation', yesterday, { due: new Date(2026, 0, 6) }),
    // Due after midnight, still before the next study day starts at 4 AM.
    reviewed('three:dictation', yesterday, { due: new Date(2026, 0, 3, 3) }),
    reviewed('three:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Due after the next study day starts.
    reviewed('four:dictation', yesterday, { due: new Date(2026, 0, 3, 5) }),
    reviewed('four:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Practised today, so its unlocked translation waits until tomorrow.
    reviewed('five:dictation', new Date(2026, 0, 2, 7)),
  );
  const conceptIds = ['one', 'two', 'three', 'four', 'five', 'six'];

  expect(countDueToday(conceptIds, cards, morning, ['dictation', 'translation'])).toBe(3);
  // Without translation exercises, nothing gets unlocked.
  expect(countDueToday(conceptIds, cards, morning, ['dictation'])).toBe(2);
});

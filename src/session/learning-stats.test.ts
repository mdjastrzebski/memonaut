import { expect, test } from 'vitest';

import type { Card, Deck } from '@/domain/types';
import type { AnswerLog, CardLog, SessionLog } from '@/progress/effort-log';
import { createSrsCard, Rating, State, type Grade } from '@/srs/scheduler';

import {
  getConceptsProgress,
  getDailyTotals,
  getDayStarts,
  getDeckTimes,
  getHardestConcepts,
  getStreak,
  summarizePeriod,
} from './learning-stats';

const MINUTE = 60_000;
// Saturday 17 October 2026, noon local time.
const now = new Date(2026, 9, 17, 12);

function answer(cardId: string, rating: Grade = Rating.Good): AnswerLog {
  return {
    cardId,
    exerciseType: 'translation',
    state: State.Review,
    difficulty: 5,
    rating,
    elapsedMs: 3000,
    atMs: 0,
  };
}

function cardLog(cardId: string, state: State, answers = 1): CardLog {
  return {
    cardId,
    exerciseType: 'translation',
    state,
    difficulty: 0,
    retrievability: 0,
    answers,
    done: true,
  };
}

function session(
  startedAt: Date,
  activeMs: number,
  {
    deckId = 'german/core',
    answers = [answer('german/a:translation')],
    cards = [] as CardLog[],
  } = {},
): SessionLog {
  return {
    startedAt: startedAt.toISOString(),
    subjectId: deckId.split('/')[0],
    deckId,
    minutes: 10,
    pointsPerMinute: 4,
    plannedEffort: 40,
    activeMs,
    paceAfter: 4,
    cards,
    answers,
  };
}

function card(conceptId: string, state: State, difficulty: number, lapses = 0): Card {
  return {
    id: `${conceptId}:translation`,
    conceptId,
    exerciseType: 'translation',
    srs: { ...createSrsCard(now), state, difficulty, lapses },
  };
}

test('the last 7 study days end with today, each starting at 4 AM', () => {
  const starts = getDayStarts(now);
  expect(starts).toHaveLength(7);
  expect(starts[0]).toEqual(new Date(2026, 9, 11, 4));
  expect(starts.at(-1)).toEqual(new Date(2026, 9, 17, 4));
  // Before 4 AM, today is still the study day before.
  expect(getDayStarts(new Date(2026, 9, 17, 3)).at(-1)).toEqual(new Date(2026, 9, 16, 4));
});

test('adds up a value per study day, oldest first', () => {
  const sessions = [
    session(new Date(2026, 9, 17, 9), 10 * MINUTE),
    // Before 4 AM counts as the study day before.
    session(new Date(2026, 9, 17, 2), 5 * MINUTE),
    session(new Date(2026, 9, 16, 18), 2 * MINUTE),
    session(new Date(2026, 9, 15, 18), 7 * MINUTE),
    // Too long ago to show.
    session(new Date(2026, 9, 10, 18), 9 * MINUTE),
  ];
  expect(getDailyTotals(sessions, now, (session) => session.activeMs, 3)).toEqual([
    7 * MINUTE,
    7 * MINUTE,
    10 * MINUTE,
  ]);
});

test('summarizes a period: time, days, accuracy and new words', () => {
  const sessions = [
    session(new Date(2026, 9, 16, 18), 10 * MINUTE, {
      answers: [answer('german/a:translation'), answer('german/b:translation', Rating.Again)],
      cards: [
        cardLog('german/a:translation', State.New),
        cardLog('german/b:translation', State.Review),
      ],
    }),
    // Before 4 AM counts as the study day before.
    session(new Date(2026, 9, 17, 2), 5 * MINUTE, {
      cards: [cardLog('german/c:dictation', State.New, 0)],
    }),
  ];
  expect(summarizePeriod(sessions, getDayStarts(now)[0], now)).toEqual({
    activeMs: 15 * MINUTE,
    sessions: 2,
    answers: 3,
    correct: 2,
    days: 1,
    newConcepts: 1,
  });
});

test('counts study days in a row, keeping a streak that ended yesterday', () => {
  const days = [16, 15, 14, 12].map((day) => session(new Date(2026, 9, day, 18), MINUTE));
  expect(getStreak(days, now)).toBe(3);
  expect(getStreak([...days, session(new Date(2026, 9, 17, 9), MINUTE)], now)).toBe(4);
  expect(getStreak(days, new Date(2026, 9, 18, 12))).toBe(0);
});

test('ranks decks by time spent', () => {
  const times = getDeckTimes(
    [
      session(new Date(2026, 9, 16, 18), 5 * MINUTE, { deckId: 'german/kapitel-1' }),
      session(new Date(2026, 9, 15, 18), 3 * MINUTE),
      session(new Date(2026, 9, 14, 18), 4 * MINUTE),
    ],
    now,
    3,
  );
  expect(times.map(({ deckId, activeMs, sessions }) => [deckId, activeMs, sessions])).toEqual([
    ['german/core', 7 * MINUTE, 2],
    ['german/kapitel-1', 5 * MINUTE, 1],
  ]);
  expect(times[0].daily).toEqual([3 * MINUTE, 0, 0]);
});

test('a word in several decks is learned once every exercise of them is', () => {
  const deck = (id: string, exerciseTypes: Deck['exerciseTypes']): Deck => ({
    id,
    subjectId: 'german',
    kind: 'unit',
    name: id,
    conceptIds: ['german/a'],
    exerciseTypes,
  });
  const learned = card('german/a', State.Review, 2);
  const cards = { [learned.id]: learned };
  expect(getConceptsProgress([deck('one', ['translation'])], cards).get('german/a')).toBe(
    'learned',
  );
  expect(
    getConceptsProgress([deck('one', ['translation']), deck('two', ['dictation'])], cards).get(
      'german/a',
    ),
  ).toBe('learning');
});

test('the hardest words are the most difficult, then most forgotten, leaving out easy ones', () => {
  const cards = [
    card('german/easy', State.Review, 2),
    card('german/hard', State.Review, 8),
    card('german/forgotten', State.Relearning, 4, 2),
    card('german/harder', State.Learning, 9),
    card('german/new', State.New, 9),
    card('english/hard', State.Review, 9),
  ];
  const sessions = [
    session(now, MINUTE, {
      answers: [
        answer('german/hard:translation', Rating.Again),
        answer('german/hard:dictation', Rating.Again),
      ],
    }),
  ];
  const conceptIds = [
    'german/easy',
    'german/hard',
    'german/forgotten',
    'german/harder',
    'german/new',
  ];
  expect(getHardestConcepts(conceptIds, cards, sessions, 10)).toEqual([
    { conceptId: 'german/harder', difficulty: 9, lapses: 0, misses: 0 },
    { conceptId: 'german/hard', difficulty: 8, lapses: 0, misses: 2 },
    { conceptId: 'german/forgotten', difficulty: 4, lapses: 2, misses: 0 },
  ]);
  expect(getHardestConcepts(conceptIds, cards, sessions, 1)).toHaveLength(1);
});

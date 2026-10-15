import { expect, test } from 'vitest';

import type { Concept, Deck } from '@/domain/types';
import { createSession, submitReview } from '@/session/session';
import { Rating, State } from '@/srs/scheduler';

import {
  appendEffortLog,
  clearEffortLog,
  finishSessionLog,
  loadEffortLog,
  startSessionLog,
} from './effort-log';

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
  exerciseTypes: ['dictation'],
};
const start = new Date('2026-01-01T10:00:00Z');

test('logs the plan, then the answers and which cards were done with', () => {
  const session = createSession({ deck, concepts, now: start, random: () => 0.99 });
  const log = startSessionLog(session, 10, 8);
  expect(log).toMatchObject({
    startedAt: '2026-01-01T10:00:00.000Z',
    deckId: 'numbers',
    minutes: 10,
    pointsPerMinute: 8,
    plannedEffort: 8,
    cards: [
      { cardId: 'one:dictation', state: State.New, answers: 0, done: false },
      { cardId: 'two:dictation', state: State.New, answers: 0, done: false },
    ],
  });

  // Easy graduates the first card, so it leaves the session.
  const answered = submitReview(session, {
    input: 'eins',
    elapsedMs: 1500,
    rating: Rating.Easy,
    issues: [],
    now: new Date(start.getTime() + 2000),
  });
  const finished = finishSessionLog(log, answered, 60_000, 9);
  expect(finished).toMatchObject({
    activeMs: 60_000,
    paceAfter: 9,
    cards: [
      { cardId: 'one:dictation', answers: 1, done: true },
      { cardId: 'two:dictation', answers: 0, done: false },
    ],
    answers: [
      {
        cardId: 'one:dictation',
        exerciseType: 'dictation',
        state: State.New,
        rating: Rating.Easy,
        elapsedMs: 1500,
        atMs: 2000,
      },
    ],
  });
});

test('keeps the latest 100 sessions, and can be cleared', () => {
  const log = startSessionLog(createSession({ deck, concepts, now: start }), 10, 8);
  for (let i = 0; i < 101; i++) appendEffortLog({ ...log, minutes: i });
  const sessions = loadEffortLog();
  expect(sessions).toHaveLength(100);
  expect(sessions[0].minutes).toBe(1);

  clearEffortLog();
  expect(loadEffortLog()).toEqual([]);
});

test('reads nothing from unreadable data', () => {
  localStorage.setItem('memonaut:effort-log', '{oops');
  expect(loadEffortLog()).toEqual([]);
});

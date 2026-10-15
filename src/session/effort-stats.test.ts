import { expect, test } from 'vitest';

import type { ExerciseType } from '@/domain/types';
import type { AnswerLog, CardLog, SessionLog } from '@/progress/effort-log';
import { Rating, State } from '@/srs/scheduler';

import { getEffortStats } from './effort-stats';

function answer(exerciseType: ExerciseType, atMs: number, elapsedMs: number): AnswerLog {
  return {
    cardId: `word:${exerciseType}`,
    exerciseType,
    state: State.New,
    difficulty: 0,
    rating: Rating.Good,
    elapsedMs,
    atMs,
  };
}

function session(answers: AnswerLog[], cards: CardLog[] = []): SessionLog {
  return {
    startedAt: '2026-01-01T10:00:00.000Z',
    subjectId: 'german',
    deckId: 'german/core',
    minutes: 10,
    pointsPerMinute: 8,
    plannedEffort: 80,
    activeMs: 600_000,
    paceAfter: 8,
    cards,
    answers,
  };
}

test('times each answer from showing it until the next exercise shows', () => {
  // Recognition: shown at 0, answered at 2s, next shown at 4s. Dictation: shown at 4s, answered at
  // 10s, next shown at 12s. The last answer's feedback time is unknown.
  const { types, msPerPoint } = getEffortStats([
    session([
      answer('recognition-choice', 2000, 2000),
      answer('dictation', 10_000, 6000),
      answer('dictation', 14_000, 2000),
    ]),
  ]);
  expect(types).toEqual([
    expect.objectContaining({
      exerciseType: 'recognition-choice',
      answers: 1,
      medianAnswerMs: 2000,
      medianTotalMs: 4000,
      msPerPoint: 4000,
    }),
    expect.objectContaining({
      exerciseType: 'dictation',
      answers: 1,
      medianAnswerMs: 6000,
      medianTotalMs: 8000,
      msPerPoint: 4000,
    }),
  ]);
  expect(msPerPoint).toBe(4000);
  // Both take as long per point, so the points are right.
  expect(types.map((row) => row.suggestedPoints)).toEqual([1, 2]);
});

test('suggests more points for a type that takes longer per point', () => {
  const { types } = getEffortStats([
    session([
      answer('recognition-choice', 2000, 2000),
      answer('recognition-choice', 6000, 2000),
      answer('translation', 24_000, 16_000),
      answer('translation', 30_000, 2000),
    ]),
  ]);
  const translation = types.find((row) => row.exerciseType === 'translation')!;
  // 20s for 2.5 points is 8s a point, against 4s for recognition and a 4s median.
  expect(translation.msPerPoint).toBe(8000);
  expect(translation.suggestedPoints).toBeGreaterThan(translation.points);
});

test('leaves out answers with a stretch away from the screen', () => {
  const { types } = getEffortStats([
    session([
      answer('recognition-choice', 2000, 2000),
      answer('recognition-choice', 90_000, 2000),
      answer('recognition-choice', 92_000, 1000),
    ]),
  ]);
  expect(types[0].answers).toBe(1);
});

test('compares how often cards were answered with how often they were expected to be', () => {
  const card = (state: State, answers: number, done = true): CardLog => ({
    cardId: 'word:dictation',
    exerciseType: 'dictation',
    state,
    difficulty: 5,
    retrievability: 0.9,
    answers,
    done,
  });
  const { answerCounts } = getEffortStats([
    session([], [card(State.New, 3), card(State.New, 2), card(State.New, 1, false)]),
    session([], [card(State.Review, 1)]),
  ]);
  expect(answerCounts).toEqual([
    { state: State.New, cards: 2, answers: 2.5, expected: 2 },
    { state: State.Review, cards: 1, answers: 1, expected: 1.1 },
  ]);
});

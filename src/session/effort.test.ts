import { expect, test } from 'vitest';

import type { Card, ExerciseType } from '@/domain/types';
import { createSrsCard, Rating, reviewSrsCard, type FsrsCard } from '@/srs/scheduler';

import { getCardEffort, updatePace } from './effort';

const now = new Date('2026-01-01T10:00:00Z');

function card(exerciseType: ExerciseType, srs: FsrsCard = createSrsCard(now)): Card {
  return { id: `one:${exerciseType}`, conceptId: 'one', exerciseType, srs };
}

/** Reviewed Easy a week ago, so it's in Review, with its difficulty and stability overridden. */
function inReview(difficulty: number, stability = 7): FsrsCard {
  const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const { card } = reviewSrsCard(createSrsCard(lastWeek), Rating.Easy, lastWeek);
  return { ...card, difficulty, stability };
}

test('typing an answer takes more effort than picking one', () => {
  expect(getCardEffort(card('translation'), now)).toBeGreaterThan(
    getCardEffort(card('translation-choice'), now),
  );
  expect(getCardEffort(card('question-type'), now)).toBeGreaterThan(
    getCardEffort(card('question-choice'), now),
  );
});

test('a new card counts its learning step', () => {
  expect(getCardEffort(card('recognition-choice'), now)).toBe(2);
});

test('a harder card takes more effort', () => {
  const easy = getCardEffort(card('dictation', inReview(2)), now);
  const average = getCardEffort(card('dictation', inReview(5)), now);
  const hard = getCardEffort(card('dictation', inReview(9)), now);
  expect(easy).toBeLessThan(average);
  expect(average).toBeLessThan(hard);
});

test('a card likely forgotten takes more effort, as it comes back to be relearned', () => {
  expect(getCardEffort(card('dictation', inReview(5, 1)), now)).toBeGreaterThan(
    getCardEffort(card('dictation', inReview(5)), now),
  );
});

test('moves the pace toward the one measured, more so in a longer session', () => {
  const minutes = (n: number) => n * 60_000;
  // 100 points in 10 minutes is 10 per minute.
  expect(updatePace(8, 100, minutes(10))).toBe(9);
  expect(updatePace(8, 50, minutes(5))).toBe(8.5);
  // Too short to tell, or nothing answered.
  expect(updatePace(8, 10, 30_000)).toBe(8);
  expect(updatePace(8, 0, minutes(10))).toBe(8);
  // Kept within limits.
  expect(updatePace(8, 10_000, minutes(10))).toBe(40);
});

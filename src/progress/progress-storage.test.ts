import { expect, test } from 'vitest';

import type { Card } from '@/domain/types';
import { createSrsCard, Rating, reviewSrsCard, State } from '@/srs/scheduler';

import { getProgressKey, loadProgress, saveProgress } from './progress-storage';

const now = new Date('2026-10-10T12:00:00Z');
const key = getProgressKey('german');

function reviewedCard(): Card {
  const { card: srs } = reviewSrsCard(createSrsCard(now), Rating.Good, now);
  return {
    id: 'german/number-3:dictation',
    conceptId: 'german/number-3',
    exerciseType: 'dictation',
    srs,
  };
}

const stored = () => JSON.parse(localStorage.getItem(key)!);

test('saves review state compactly, per subject, word and exercise type', () => {
  const card = reviewedCard();
  saveProgress('german', [card]);

  expect(stored()).toEqual({
    version: 1,
    words: {
      'number-3': {
        dictation: {
          d: card.srs.due.getTime() / 1000,
          s: Math.round(card.srs.stability * 10_000) / 10_000,
          df: Math.round(card.srs.difficulty * 10_000) / 10_000,
          st: State.Learning,
          r: 1,
          ls: 1,
          lr: now.getTime() / 1000,
        },
      },
    },
  });
  expect(localStorage.getItem(getProgressKey('english'))).toBeNull();
});

test('loads what was saved, and reviews it the same way', () => {
  const card = reviewedCard();
  saveProgress('german', [card]);

  const loaded = loadProgress('german')[card.id];
  const { stability, difficulty, ...exact } = card.srs;
  expect(loaded).toMatchObject({ ...card, srs: exact });
  expect(loaded.srs.stability).toBeCloseTo(stability, 4);
  expect(loaded.srs.difficulty).toBeCloseTo(difficulty, 4);

  const later = new Date('2026-10-13T12:00:00Z');
  expect(reviewSrsCard(loaded.srs, Rating.Good, later).card.due).toEqual(
    reviewSrsCard(card.srs, Rating.Good, later).card.due,
  );
});

test('saving keeps other words, exercise types and unknown fields', () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      note: 'kept',
      words: {
        'removed-word': { dictation: { d: 1, st: 2 } },
        'number-3': { spelling: { d: 1 }, dictation: { d: 1, ls: 2, extra: 'kept' } },
      },
    }),
  );
  saveProgress('german', [reviewedCard()]);

  const data = stored();
  expect(data.note).toBe('kept');
  expect(data.words['removed-word']).toEqual({ dictation: { d: 1, st: 2 } });
  expect(data.words['number-3'].spelling).toEqual({ d: 1 });
  expect(data.words['number-3'].dictation).toMatchObject({ extra: 'kept', ls: 1 });
});

test('skips broken entries but loads the rest', () => {
  localStorage.setItem(
    key,
    JSON.stringify({
      version: 1,
      words: {
        'broken': { dictation: { s: 1 } },
        'number-3': { dictation: { d: 1_760_000_000 }, translation: 'oops' },
        'number-4': 7,
      },
    }),
  );
  expect(Object.keys(loadProgress('german'))).toEqual(['german/number-3:dictation']);
  expect(loadProgress('german')['german/number-3:dictation'].srs.state).toBe(State.New);
});

test('never overwrites data from a newer version', () => {
  const newer = JSON.stringify({ version: 2, words: {} });
  localStorage.setItem(key, newer);
  saveProgress('german', [reviewedCard()]);
  expect(localStorage.getItem(key)).toBe(newer);
});

test('keeps unreadable data aside before saving over it', () => {
  localStorage.setItem(key, '{oops');
  expect(loadProgress('german')).toEqual({});

  saveProgress('german', [reviewedCard()]);
  expect(localStorage.getItem(`${key}:unreadable`)).toBe('{oops');
  expect(Object.keys(loadProgress('german'))).toEqual(['german/number-3:dictation']);
});

import { expect, test } from 'vitest';

import { loadXp, saveSessionXp, type SessionXp } from './xp-storage';

const key = 'memonaut:xp';
const stored = () => JSON.parse(localStorage.getItem(key)!);

const session = (startedAt: string, xp: number): SessionXp => ({
  startedAt,
  subjectId: 'german',
  deckId: 'kapitel-1',
  activeMs: 60_000,
  xp,
});
const first = session('2026-10-18T15:00:00.000Z', 10);
const second = session('2026-10-18T16:00:00.000Z', 4.5);

test('starts with no XP', () => {
  expect(loadXp()).toEqual({ total: 0, sessions: [] });
});

test('adds up the XP of each session, and keeps a record of them', () => {
  saveSessionXp(first);
  expect(saveSessionXp(second)).toEqual({ total: 14.5, sessions: [first, second] });
  expect(loadXp()).toEqual({ total: 14.5, sessions: [first, second] });
  expect(stored()).toEqual({ version: 1, total: 14.5, sessions: [first, second] });
});

test('saving a session again replaces it', () => {
  saveSessionXp(first);
  saveSessionXp(second);
  const later = { ...first, xp: 12, activeMs: 90_000 };
  expect(saveSessionXp(later)).toEqual({ total: 16.5, sessions: [later, second] });
});

test('keeps the total once older sessions are gone, and fields it does not know', () => {
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, total: 100, sessions: [{ ...first, mood: 'happy' }, 'broken'] }),
  );
  expect(loadXp()).toEqual({ total: 100, sessions: [first] });
  saveSessionXp({ ...first, xp: 15 });
  expect(stored().total).toBe(105);
  expect(stored().sessions).toEqual([{ ...first, xp: 15, mood: 'happy' }, 'broken']);
});

test('reads data from a newer version but never overwrites it', () => {
  const newer = JSON.stringify({ version: 2, total: 50, sessions: [first] });
  localStorage.setItem(key, newer);
  expect(saveSessionXp(second)).toEqual({ total: 54.5, sessions: [first, second] });
  expect(localStorage.getItem(key)).toBe(newer);
});

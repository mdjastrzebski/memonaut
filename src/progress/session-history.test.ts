import { expect, test } from 'vitest';

import { getTotalXp, loadSessions, saveSession, type SessionRecord } from './session-history';

const key = 'memonaut:sessions';
const stored = () => JSON.parse(localStorage.getItem(key)!);

const session = (startedAt: string, xp: number): SessionRecord => ({
  startedAt,
  subjectId: 'german',
  deckId: 'german/kapitel-1',
  activeMs: 60_000,
  xp,
});
const first = session('2026-10-18T15:00:00.000Z', 10);
const second = session('2026-10-18T16:00:00.000Z', 4.5);

test('starts with no sessions', () => {
  expect(loadSessions()).toEqual([]);
  expect(getTotalXp(loadSessions())).toBe(0);
});

test('keeps every session, whose XP adds up to the total', () => {
  saveSession(first);
  expect(saveSession(second)).toEqual([first, second]);
  expect(loadSessions()).toEqual([first, second]);
  expect(stored()).toEqual({ version: 1, sessions: [first, second] });
  expect(getTotalXp(loadSessions())).toBe(14.5);
});

test('saving a session again replaces it', () => {
  saveSession(first);
  saveSession(second);
  const later = { ...first, xp: 12, activeMs: 90_000 };
  expect(saveSession(later)).toEqual([later, second]);
});

test('skips broken sessions and keeps fields it does not know', () => {
  localStorage.setItem(
    key,
    JSON.stringify({ version: 1, sessions: [{ ...first, mood: 'happy' }, 'broken'] }),
  );
  expect(loadSessions()).toEqual([first]);
  saveSession({ ...first, xp: 15 });
  expect(stored().sessions).toEqual([{ ...first, xp: 15, mood: 'happy' }, 'broken']);
});

test('reads data from a newer version but never overwrites it', () => {
  const newer = JSON.stringify({ version: 2, sessions: [first] });
  localStorage.setItem(key, newer);
  expect(saveSession(second)).toEqual([first, second]);
  expect(localStorage.getItem(key)).toBe(newer);
});

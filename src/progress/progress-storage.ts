import { z } from 'zod';

import type { Card } from '@/domain/types';
import { EXERCISE_TYPES, getCardId } from '@/session/session';
import { State, type FsrsCard } from '@/srs/scheduler';

/**
 * Learning progress is kept in localStorage, one key per Subject:
 *
 * ```json
 * { "version": 1, "words": { "number-3": { "dictation": { "d": 1760256000, "s": 2.3065, … } } } }
 * ```
 *
 * Words are keyed by Concept id without the Subject prefix, then by Exercise Type. Review state is
 * stored compactly (see `srsSchema`) to stay well within the storage quota. Each entry is
 * read on its own, so a broken one doesn't hide the rest. Saving only replaces the entries that
 * changed and keeps everything else as stored, including words, Exercise Types and fields this
 * version doesn't know about. Data from a newer version is read but never overwritten.
 */
const VERSION = 1;

export function getProgressKey(subjectId: string): string {
  return `memonaut:progress:${subjectId}`;
}

/** Unix time in whole seconds. */
const seconds = z.number().transform((value) => new Date(value * 1000));
/** Left out when 0. */
const number = z.number().default(0);

/**
 * An FSRS card as stored: short keys, times in Unix seconds, and fields left out when they're 0 or
 * unset. The deprecated `elapsed_days` isn't stored; FSRS works it out from the last review.
 */
const srsSchema = z
  .object({
    /** Due */
    d: seconds,
    /** Stability */
    s: number,
    /** Difficulty */
    df: number,
    /** State; New if left out */
    st: z.enum(State).default(State.New),
    /** Reps */
    r: number,
    /** Lapses */
    l: number,
    /** Scheduled days */
    sd: number,
    /** Learning steps */
    ls: number,
    /** Last review */
    lr: seconds.optional(),
  })
  .transform((stored): FsrsCard => ({
    due: stored.d,
    stability: stored.s,
    difficulty: stored.df,
    state: stored.st,
    reps: stored.r,
    lapses: stored.l,
    scheduled_days: stored.sd,
    learning_steps: stored.ls,
    elapsed_days: 0,
    last_review: stored.lr,
  }));

type StoredSrs = z.input<typeof srsSchema>;

function toStoredSrs(srs: FsrsCard): Partial<StoredSrs> {
  const stored: StoredSrs = {
    d: toSeconds(srs.due),
    s: round(srs.stability),
    df: round(srs.difficulty),
    st: srs.state,
    r: srs.reps,
    l: srs.lapses,
    sd: srs.scheduled_days,
    ls: srs.learning_steps,
    lr: srs.last_review && toSeconds(srs.last_review),
  };
  return Object.fromEntries(
    Object.entries(stored).filter(([key, value]) => key === 'd' || (value !== 0 && value != null)),
  );
}

const STORED_SRS_KEYS = ['d', 's', 'df', 'st', 'r', 'l', 'sd', 'ls', 'lr'];

const toSeconds = (date: Date) => Math.round(date.getTime() / 1000);
/** Four decimals keep scheduling the same while saving space. */
const round = (value: number) => Math.round(value * 10_000) / 10_000;

type StoredData = Record<string, unknown> & { version: number; words: Record<string, unknown> };

/** Cards practised in a Subject, keyed by Card id. */
export function loadProgress(subjectId: string): Record<string, Card> {
  const cards: Record<string, Card> = {};
  const data = read(subjectId);
  if (!data.ok) return cards;

  for (const [wordId, exercises] of Object.entries(data.value.words)) {
    if (!isObject(exercises)) continue;
    const conceptId = `${subjectId}/${wordId}`;
    for (const exerciseType of EXERCISE_TYPES) {
      const srs = srsSchema.safeParse(exercises[exerciseType]);
      if (!srs.success) continue;
      const id = getCardId(conceptId, exerciseType);
      cards[id] = { id, conceptId, exerciseType, srs: srs.data };
    }
  }
  return cards;
}

/** Stores the review state of the given Cards, all from one Subject, keeping everything else. */
export function saveProgress(subjectId: string, cards: Card[]) {
  const data = read(subjectId);
  if (data.ok && data.value.version > VERSION) {
    // Written by a newer version that might store things differently; keep progress in memory only.
    return;
  }
  const stored = data.ok ? data.value : { version: VERSION, words: {} };
  if (!data.ok && data.raw !== null) {
    // Unreadable data isn't dropped silently; it stays next to the new data for a later fix.
    write(`${getProgressKey(subjectId)}:unreadable`, data.raw);
  }

  const words = { ...stored.words };
  for (const card of cards) {
    const wordId = card.conceptId.slice(subjectId.length + 1);
    const exercises = isObject(words[wordId]) ? words[wordId] : {};
    const previous = exercises[card.exerciseType];
    // Fields this version doesn't know, e.g. added by a later one, are kept.
    const unknown = isObject(previous)
      ? Object.fromEntries(
          Object.entries(previous).filter(([key]) => !STORED_SRS_KEYS.includes(key)),
        )
      : {};
    words[wordId] = {
      ...exercises,
      [card.exerciseType]: { ...unknown, ...toStoredSrs(card.srs) },
    };
  }
  write(getProgressKey(subjectId), JSON.stringify({ ...stored, version: VERSION, words }));
}

type ReadResult = { ok: true; value: StoredData } | { ok: false; raw: string | null };

function read(subjectId: string): ReadResult {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(getProgressKey(subjectId));
    if (raw === null) return { ok: false, raw };
    const value: unknown = JSON.parse(raw);
    if (!isObject(value) || !isObject(value.words)) return { ok: false, raw };
    const version = typeof value.version === 'number' ? value.version : VERSION;
    return { ok: true, value: { ...value, version, words: value.words } };
  } catch {
    return { ok: false, raw };
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be full or blocked, e.g. in private mode; progress is then only kept until reload.
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

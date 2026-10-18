import type { ExerciseType } from '@/domain/types';
import type { Session } from '@/session/session';
import { getRetrievability, type Grade, type State } from '@/srs/scheduler';

/**
 * A record of each session's plan and answers, kept to tune the effort points against the time
 * answers really take. Stored raw, without points, so it can be read again after the points
 * change. Kept in localStorage as `{ "version": 1, "sessions": [...] }`, the latest
 * `MAX_SESSIONS` only.
 */
const STORAGE_KEY = 'memonaut:effort-log';
const VERSION = 1;
export const MAX_SESSIONS = 100;

/** A Card picked for a session, with its memory state when the session started. */
export interface CardLog {
  cardId: string;
  exerciseType: ExerciseType;
  state: State;
  difficulty: number;
  /** Chance of recall when the session started, 0–1. */
  retrievability: number;
  /** How many times it was answered. */
  answers: number;
  /** Whether it was done with by the end: false if the session ended before it graduated. */
  done: boolean;
}

/** One answer, with the Card's memory state before it. */
export interface AnswerLog {
  cardId: string;
  exerciseType: ExerciseType;
  state: State;
  difficulty: number;
  rating: Grade;
  /** From showing the exercise to checking the answer. */
  elapsedMs: number;
  /** When the answer was checked, since the session started. */
  atMs: number;
}

export interface SessionLog {
  /** ISO time. */
  startedAt: string;
  subjectId: string;
  deckId: string;
  /** Minutes picked on the setup screen. */
  minutes: number;
  /** The pace the session was planned with, in effort points per minute. */
  pointsPerMinute: number;
  /** Effort points the picked Cards were expected to take. */
  plannedEffort: number;
  /** Time spent practising, without the idle stretches. */
  activeMs: number;
  /** The pace measured with this session. */
  paceAfter: number;
  cards: CardLog[];
  answers: AnswerLog[];
}

/** The log of a session just started: its plan and the picked Cards' memory state. */
export function startSessionLog(
  session: Session,
  minutes: number,
  pointsPerMinute: number,
): SessionLog {
  return {
    startedAt: session.startedAt.toISOString(),
    subjectId: session.deck.subjectId,
    deckId: session.deck.id,
    minutes,
    pointsPerMinute,
    plannedEffort: round(session.effort),
    activeMs: 0,
    paceAfter: pointsPerMinute,
    cards: Object.values(session.cards).map((card) => ({
      cardId: card.id,
      exerciseType: card.exerciseType,
      state: card.srs.state,
      difficulty: round(card.srs.difficulty),
      retrievability: round(getRetrievability(card.srs, session.startedAt)),
      answers: 0,
      done: false,
    })),
    answers: [],
  };
}

/** The log of a session that's over, with its answers and how long it took. */
export function finishSessionLog(
  log: SessionLog,
  session: Session,
  activeMs: number,
  paceAfter: number,
): SessionLog {
  const startedAt = session.startedAt.getTime();
  return {
    ...log,
    activeMs: Math.round(activeMs),
    paceAfter: round(paceAfter),
    cards: log.cards.map((card) => ({
      ...card,
      answers: session.reviews.filter((review) => review.cardId === card.cardId).length,
      done: !session.queue.includes(card.cardId),
    })),
    answers: session.reviews.map((review) => ({
      cardId: review.cardId,
      exerciseType: session.cards[review.cardId].exerciseType,
      state: review.log.state,
      difficulty: round(review.log.difficulty),
      rating: review.rating,
      elapsedMs: Math.round(review.elapsedMs),
      atMs: review.log.review.getTime() - startedAt,
    })),
  };
}

/** Logged sessions, oldest first. */
export function loadEffortLog(): SessionLog[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (typeof value !== 'object' || value === null || !('sessions' in value)) return [];
    return Array.isArray(value.sessions) ? (value.sessions as SessionLog[]) : [];
  } catch {
    return [];
  }
}

export function appendEffortLog(log: SessionLog) {
  let sessions = [...loadEffortLog(), log].slice(-MAX_SESSIONS);
  // When storage is full, the oldest half of the log goes until it fits.
  while (sessions.length > 0) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: VERSION, sessions }));
      return;
    } catch {
      sessions = sessions.slice(Math.ceil(sessions.length / 2));
    }
  }
}

export function clearEffortLog() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage can be blocked, e.g. in private mode; there's nothing to clear then.
  }
}

/** Four decimals are plenty for tuning and save space. */
const round = (value: number) => Math.round(value * 10_000) / 10_000;

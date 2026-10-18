import { getProgress, type Progress } from '@/components/grades';
import type { Card, Deck, ExerciseType } from '@/domain/types';
import type { SessionLog } from '@/progress/effort-log';
import { getCardId, getConceptExerciseTypes, getDayStart } from '@/session/session';
import { Rating, State } from '@/srs/scheduler';

/**
 * Learner-facing stats over the effort log, which holds the time and answers of the latest
 * sessions, and the Cards' FSRS state, which holds how well each word is known.
 */

/** Study days shown in the daily charts, today last. */
export const DAYS = 7;

/** The starts of the last `days` study days, oldest first, ending with today's, each at 4 AM. */
export function getDayStarts(now: Date, days = DAYS): Date[] {
  const today = getDayStart(now);
  return Array.from({ length: days }, (_, index) => {
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1 - index));
    return start;
  });
}

/** A total per study day, e.g. of active time or XP, oldest first, ending with today. */
export function getDailyTotals<T extends { startedAt: string }>(
  sessions: T[],
  now: Date,
  value: (session: T) => number,
  days = DAYS,
): number[] {
  const starts = getDayStarts(now, days).map((start) => start.getTime());
  const totals = starts.map(() => 0);
  for (const session of sessions) {
    const at = new Date(session.startedAt).getTime();
    if (at < starts[0] || at > now.getTime()) continue;
    totals[starts.findLastIndex((start) => at >= start)] += value(session);
  }
  return totals;
}

export interface PeriodSummary {
  activeMs: number;
  sessions: number;
  answers: number;
  /** Answers not rated Again. */
  correct: number;
  /** Study days with a session. */
  days: number;
  /** Concepts first practised in the period. */
  newConcepts: number;
}

/** What was practised from `start` until `end`. */
export function summarizePeriod(sessions: SessionLog[], start: Date, end: Date): PeriodSummary {
  const within = sessions.filter((session) => {
    const at = new Date(session.startedAt).getTime();
    return at >= start.getTime() && at < end.getTime();
  });
  const answers = within.flatMap((session) => session.answers);
  const newConcepts = new Set(
    within.flatMap((session) =>
      session.cards
        .filter((card) => card.state === State.New && card.answers > 0)
        .map((card) => getConceptId(card.cardId)),
    ),
  );
  return {
    activeMs: within.reduce((total, session) => total + session.activeMs, 0),
    sessions: within.length,
    answers: answers.length,
    correct: answers.filter((answer) => answer.rating !== Rating.Again).length,
    days: new Set(within.map((session) => getDayStart(new Date(session.startedAt)).getTime())).size,
    newConcepts: newConcepts.size,
  };
}

/**
 * Study days in a row with an answered session, up to today. A streak that ended yesterday still
 * counts, as today can still continue it.
 */
export function getStreak(sessions: SessionLog[], now: Date): number {
  const days = new Set(
    sessions
      .filter((session) => session.answers.length > 0)
      .map((session) => getDayStart(new Date(session.startedAt)).getTime()),
  );
  const day = getDayStart(now);
  if (!days.has(day.getTime())) day.setDate(day.getDate() - 1);
  let streak = 0;
  while (days.has(day.getTime())) {
    streak++;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

export interface DeckTime {
  subjectId: string;
  deckId: string;
  activeMs: number;
  sessions: number;
  /** Active time per study day, oldest first, ending with today. */
  daily: number[];
  lastPractised: Date;
}

/** Time spent in each Deck, most first. */
export function getDeckTimes(sessions: SessionLog[], now: Date, days = DAYS): DeckTime[] {
  const byDeck = new Map<string, SessionLog[]>();
  for (const session of sessions) {
    byDeck.set(session.deckId, [...(byDeck.get(session.deckId) ?? []), session]);
  }
  return [...byDeck.values()]
    .map((deckSessions) => ({
      subjectId: deckSessions[0].subjectId,
      deckId: deckSessions[0].deckId,
      activeMs: deckSessions.reduce((total, session) => total + session.activeMs, 0),
      sessions: deckSessions.length,
      daily: getDailyTotals(deckSessions, now, (session) => session.activeMs, days),
      lastPractised: new Date(Math.max(...deckSessions.map((s) => Date.parse(s.startedAt)))),
    }))
    .filter((deck) => deck.activeMs > 0)
    .sort((a, b) => b.activeMs - a.activeMs);
}

export interface ExerciseTypeCards {
  exerciseType: ExerciseType;
  /** How well each of the Deck's Cards of this Exercise Type is known, in Deck order. */
  progress: Progress[];
}

/**
 * A Deck's Cards per Exercise Type, in the Deck's order of Exercise Types: one per Concept practised
 * with it. Exercise Types no Concept is practised with are left out.
 */
export function getDeckExerciseTypes(deck: Deck, cards: Record<string, Card>): ExerciseTypeCards[] {
  return deck.exerciseTypes
    .map((exerciseType) => ({
      exerciseType,
      progress: deck.conceptIds
        .filter((conceptId) => getConceptExerciseTypes(deck, conceptId).includes(exerciseType))
        .map((conceptId) =>
          getProgress(cards[getCardId(conceptId, exerciseType)]?.srs.state ?? State.New),
        ),
    }))
    .filter(({ progress }) => progress.length > 0);
}

/** The Concept a Card id belongs to: the id up to its Exercise Type. */
function getConceptId(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf(':'));
}

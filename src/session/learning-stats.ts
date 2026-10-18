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

/** FSRS difficulty a Card starts with when first answered Hard; a Good start is about 2. */
const HARD_DIFFICULTY = 5;

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

export interface HardConcept {
  conceptId: string;
  /** The highest FSRS difficulty of its Cards, 1–10. */
  difficulty: number;
  /** Times it was forgotten once learned. */
  lapses: number;
  /** Answers rated Again in the logged sessions. */
  misses: number;
}

/**
 * The practised Concepts that are hardest for the learner, hardest first: by their hardest Card's
 * FSRS difficulty, which wrong and almost-right answers raise, then by how often they were
 * forgotten and missed. Concepts that went well from the start are left out.
 */
export function getHardestConcepts(
  conceptIds: string[],
  cards: Card[],
  sessions: SessionLog[],
  limit: number,
): HardConcept[] {
  const included = new Set(conceptIds);
  const misses = new Map<string, number>();
  for (const answer of sessions.flatMap((session) => session.answers)) {
    if (answer.rating !== Rating.Again) continue;
    const conceptId = getConceptId(answer.cardId);
    misses.set(conceptId, (misses.get(conceptId) ?? 0) + 1);
  }

  const byConcept = new Map<string, HardConcept>();
  for (const card of cards) {
    if (!included.has(card.conceptId) || card.srs.state === State.New) continue;
    const hard = byConcept.get(card.conceptId) ?? {
      conceptId: card.conceptId,
      difficulty: 0,
      lapses: 0,
      misses: misses.get(card.conceptId) ?? 0,
    };
    hard.difficulty = Math.max(hard.difficulty, card.srs.difficulty);
    hard.lapses += card.srs.lapses;
    byConcept.set(card.conceptId, hard);
  }

  return [...byConcept.values()]
    .filter((hard) => hard.difficulty >= HARD_DIFFICULTY || hard.lapses > 0)
    .sort((a, b) => b.difficulty - a.difficulty || b.lapses - a.lapses || b.misses - a.misses)
    .slice(0, limit);
}

/** The Concept a Card id belongs to: the id up to its Exercise Type. */
function getConceptId(cardId: string): string {
  return cardId.slice(0, cardId.lastIndexOf(':'));
}

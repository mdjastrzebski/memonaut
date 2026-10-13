import type { Card, Concept, Deck, ExerciseType, Review, SubjectKind } from '@/domain/types';
import type { AnswerIssue } from '@/exercises/type-answer';
import { shuffle } from '@/lib/shuffle';
import {
  createSrsCard,
  getRetrievability,
  reviewSrsCard,
  State,
  type Grade,
} from '@/srs/scheduler';

/**
 * Cards due again within this window come back in the same session, like Anki's learn-ahead limit.
 * This lets a new card go through its learning steps (1m, 10m) and graduate to Review.
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** Every Exercise Type, easiest first. A Concept unlocks them one at a time, in a Deck's order. */
export const EXERCISE_TYPES: ExerciseType[] = [
  'recognition-choice',
  'dictation',
  'translation-choice',
  'translation',
  'question',
];

/** The Exercise Types each kind of Subject can use, easiest first. */
export const KIND_EXERCISE_TYPES: Record<SubjectKind, ExerciseType[]> = {
  lang: ['recognition-choice', 'dictation', 'translation-choice', 'translation'],
  knowledge: ['question'],
};

/** A study day starts at 4 AM local time, like Anki's, so late-evening study counts as one day. */
export const DAY_START_HOUR = 4;

/** One study sitting over a Deck. Lives in memory only. */
export interface Session {
  startedAt: Date;
  deck: Deck;
  concepts: Record<string, Concept>;
  cards: Record<string, Card>;
  /** Card ids still to practise in this session; the first one is current. */
  queue: string[];
  reviews: Review[];
}

interface CreateSessionOptions {
  deck: Deck;
  concepts: Concept[];
  /** Cards practised before, keyed by id. They keep their review state; the rest start new. */
  cards?: Record<string, Card>;
  /** Practise at most this many Cards, picked in the order of `Step`. Everything if left out. */
  maxCards?: number;
  now?: Date;
  random?: () => number;
}

/**
 * Why a session picks a Card, in the order it fills the session. A Concept practises one Exercise
 * Type per day where it can: once one of its Cards was reviewed today, or one is picked as due or
 * unlocked, its other Cards wait as held ones, used only when there's room left.
 */
const Step = {
  /** Due, most overdue first. */
  Due: 0,
  /** The next Exercise Type of a started Concept, easiest type first, then in Deck order. */
  Unlocked: 1,
  /** A new Concept's first Exercise Type, in Deck order or shuffled for a Deck with `shuffleNew`. */
  New: 2,
  /** Due, but another Card of the Concept is practised today. Most overdue first. */
  HeldDue: 3,
  /** Unlocked, but another Card of the Concept is practised today. Same order as `Unlocked`. */
  HeldUnlocked: 4,
  /** Not due yet, reviewed ahead. Soonest due first. */
  Ahead: 5,
} as const;
type Step = (typeof Step)[keyof typeof Step];

export function createSession({
  deck,
  concepts,
  cards: previous = {},
  maxCards = Infinity,
  now = new Date(),
  random = Math.random,
}: CreateSessionOptions): Session {
  // Easiest first: all Cards of one type are queued before any Card of the next.
  const { exerciseTypes } = deck;
  const deckConcepts = deck.conceptIds.flatMap((conceptId) => {
    const concept = concepts.find((concept) => concept.id === conceptId);
    return concept ? [concept] : [];
  });
  const newConceptIds = deckConcepts
    .map((concept) => concept.id)
    .filter((conceptId) =>
      getConceptCards(conceptId, previous, now, exerciseTypes).every(
        (card) => card.srs.state === State.New,
      ),
    );
  const newOrder = deck.shuffleNew ? shuffle(newConceptIds, random) : newConceptIds;

  const candidates = deckConcepts.flatMap((concept, conceptIndex) =>
    getCandidates(getConceptCards(concept.id, previous, now, exerciseTypes), now, now).map(
      ({ card, step }) => {
        const typeIndex = exerciseTypes.indexOf(card.exerciseType);
        const sortKey =
          step === Step.Unlocked || step === Step.HeldUnlocked
            ? [typeIndex, conceptIndex]
            : step === Step.New
              ? [newOrder.indexOf(concept.id), 0]
              : [card.srs.due.getTime(), conceptIndex];
        return { concept, card, sortKey: [step, ...sortKey] };
      },
    ),
  );
  candidates.sort((a, b) => compareKeys(a.sortKey, b.sortKey));
  const picked = candidates.slice(0, maxCards);
  // Grouped by Exercise Type so the queue below can keep them in order.
  const cards = exerciseTypes.flatMap((exerciseType) =>
    picked.map(({ card }) => card).filter((card) => card.exerciseType === exerciseType),
  );

  return {
    startedAt: now,
    deck,
    concepts: Object.fromEntries(picked.map(({ concept }) => [concept.id, concept])),
    cards: Object.fromEntries(cards.map((card) => [card.id, card])),
    queue: exerciseTypes.flatMap((exerciseType) =>
      shuffle(
        cards.filter((card) => card.exerciseType === exerciseType).map((card) => card.id),
        random,
      ),
    ),
    reviews: [],
  };
}

/**
 * The Cards of one Concept a session can pick, each with its `Step`. `cards` come in the Deck's
 * Exercise Type order; Cards due by `dueBy` count as due. Locked Cards are left out.
 */
function getCandidates(cards: Card[], now: Date, dueBy: Date): { card: Card; step: Step }[] {
  const started = cards.some((card) => card.srs.state !== State.New);
  if (!started) return [{ card: cards[0], step: Step.New }];

  const isDue = (card: Card) =>
    card.srs.state !== State.New && card.srs.due.getTime() <= dueBy.getTime();
  // Started Cards stay active; the first type and the one after a graduated Card are unlocked.
  const isUnlocked = (card: Card, index: number) =>
    card.srs.state === State.New && (index === 0 || hasGraduated(cards[index - 1]));

  const dayStart = getDayStart(now);
  const practisedToday = cards.filter(
    (card) => card.srs.last_review && card.srs.last_review.getTime() >= dayStart.getTime(),
  );
  let today: Card[];
  if (practisedToday.length > 0) {
    today = practisedToday.filter(isDue);
  } else {
    // The due Card most likely forgotten, the easier type on a tie, or else the easiest unlocked.
    const due = cards.filter(isDue);
    const mostForgotten = due.reduce<Card | undefined>(
      (best, card) =>
        !best || getRetrievability(card.srs, now) < getRetrievability(best.srs, now) ? card : best,
      undefined,
    );
    const unlocked = cards.find(isUnlocked);
    const first = mostForgotten ?? unlocked;
    today = first ? [first] : [];
  }

  return cards.flatMap((card, index): { card: Card; step: Step }[] => {
    const due = isDue(card);
    const unlocked = isUnlocked(card, index);
    if (today.includes(card)) return [{ card, step: due ? Step.Due : Step.Unlocked }];
    if (due) return [{ card, step: Step.HeldDue }];
    if (unlocked) return [{ card, step: Step.HeldUnlocked }];
    if (card.srs.state !== State.New) return [{ card, step: Step.Ahead }];
    return [];
  });
}

/** Whether a Card has reached Review, even if it lapsed since. */
function hasGraduated(card: Card): boolean {
  return card.srs.state === State.Review || card.srs.state === State.Relearning;
}

/** When the study day of `now` started: the last 4 AM local time. */
export function getDayStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(DAY_START_HOUR, 0, 0, 0);
  if (start.getTime() > now.getTime()) start.setDate(start.getDate() - 1);
  return start;
}

function compareKeys(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/** A Concept's Card for each Exercise Type: the one practised before, or a new one. */
export function getConceptCards(
  conceptId: string,
  cards: Record<string, Card>,
  now: Date,
  exerciseTypes = EXERCISE_TYPES,
): Card[] {
  return exerciseTypes.map((exerciseType) => {
    const id = getCardId(conceptId, exerciseType);
    return cards[id] ?? { id, conceptId, exerciseType, srs: createSrsCard(now) };
  });
}

/**
 * How many of the Concepts need practice before the next study day starts, with their Subject's
 * Exercise Types: those with a Card a session would pick as due or unlocked. New Concepts and
 * Cards held back for today don't count.
 */
export function countDueToday(
  conceptIds: string[],
  cards: Record<string, Card>,
  now: Date,
  exerciseTypes = EXERCISE_TYPES,
): number {
  const nextDayStart = getDayStart(now);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  return conceptIds.filter((conceptId) =>
    getCandidates(getConceptCards(conceptId, cards, now, exerciseTypes), now, nextDayStart).some(
      ({ step }) => step === Step.Due || step === Step.Unlocked,
    ),
  ).length;
}

/** The id of the Card that practises a Concept with an Exercise Type. */
export function getCardId(conceptId: string, exerciseType: ExerciseType): string {
  return `${conceptId}:${exerciseType}`;
}

export function getCurrentCard(session: Session): Card | undefined {
  const cardId = session.queue[0];
  return cardId ? session.cards[cardId] : undefined;
}

/**
 * How far the session is, from 0 to 1: a Card counts fully once it leaves the session and half
 * while it's still queued after being answered. Never goes back down.
 */
export function getSessionProgress(session: Session): number {
  const total = Object.keys(session.cards).length;
  if (total === 0) return 1;
  const answered = new Set(session.reviews.map((review) => review.cardId));
  const answeredInQueue = session.queue.filter((cardId) => answered.has(cardId)).length;
  const done = total - session.queue.length;
  return (done + answeredInQueue / 2) / total;
}

export interface SubmitReviewInput {
  input: string;
  elapsedMs: number;
  rating: Grade;
  issues: AnswerIssue[];
  now: Date;
}

/** Applies a review to the current Card and moves it to the end of the queue if it's due again soon. */
export function submitReview(session: Session, { now, ...answer }: SubmitReviewInput): Session {
  const card = getCurrentCard(session);
  if (!card) {
    return session;
  }

  const { card: srsAfter, log } = reviewSrsCard(card.srs, answer.rating, now);
  const dueSoon = srsAfter.due.getTime() - now.getTime() <= LEARN_AHEAD_MS;
  const rest = session.queue.slice(1);

  return {
    ...session,
    cards: { ...session.cards, [card.id]: { ...card, srs: srsAfter } },
    queue: dueSoon ? [...rest, card.id] : rest,
    reviews: [...session.reviews, { cardId: card.id, ...answer, log, srsAfter }],
  };
}

import type { Card, Concept, Deck, ExerciseType, Review } from '@/domain/types';
import type { AnswerIssue } from '@/exercises/type-answer';
import { shuffle } from '@/lib/shuffle';
import { createSrsCard, reviewSrsCard, State, type Grade } from '@/srs/scheduler';

/**
 * Cards due again within this window come back in the same session, like Anki's learn-ahead limit.
 * This lets a new card go through its learning steps (1m, 10m) and graduate to Review.
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** Every Exercise Type, easiest first. A session practises a new Concept with all of them. */
export const EXERCISE_TYPES: ExerciseType[] = [
  'recognition-choice',
  'dictation',
  'translation-choice',
  'translation',
];

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
  /**
   * Session size, as Concepts with all their exercises: at most `maxConcepts` × Exercise Types
   * Cards, picked with `pickConcepts`. Everything if left out.
   */
  maxConcepts?: number;
  now?: Date;
  random?: () => number;
}

export function createSession({
  deck,
  concepts,
  cards: previous = {},
  maxConcepts = Infinity,
  now = new Date(),
  random = Math.random,
}: CreateSessionOptions): Session {
  // Easiest first: all Cards of one type are queued before any Card of the next.
  const { exerciseTypes } = deck;
  const items = concepts
    .filter((concept) => deck.conceptIds.includes(concept.id))
    .map((concept) => ({
      concept,
      cards: getConceptCards(concept.id, previous, now, exerciseTypes),
    }));
  const deckConcepts = pickConcepts(
    deck.shuffleNew ? shuffle(items, random) : items,
    maxConcepts * exerciseTypes.length,
    now,
  );
  // Grouped by Exercise Type so the queue below can keep them in order.
  const cards = exerciseTypes.flatMap((exerciseType) =>
    deckConcepts.flatMap(({ cards }) => cards.filter((card) => card.exerciseType === exerciseType)),
  );

  return {
    startedAt: now,
    deck,
    concepts: Object.fromEntries(deckConcepts.map(({ concept }) => [concept.id, concept])),
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

interface ConceptCards {
  concept: Concept;
  cards: Card[];
}

/**
 * Picks Concepts to practise until they bring at least `maxCards` Cards, in this order:
 * 1. started ones that are due, or whose other exercises haven't been practised yet, most overdue
 *    first, with only those Cards
 * 2. new ones, in the order given (Deck order, or shuffled for a Deck with `shuffleNew`)
 * 3. the rest, soonest due first
 * So a Concept with only some exercises due leaves room for more new Concepts.
 */
function pickConcepts(items: ConceptCards[], maxCards: number, now: Date): ConceptCards[] {
  const rank = ({ cards }: ConceptCards): [group: number, due: number] => {
    const started = cards.filter((card) => card.srs.state !== State.New);
    if (started.length === 0) return [1, 0];
    const due = Math.min(...started.map((card) => card.srs.due.getTime()));
    return isConceptDue(cards, now) ? [0, due] : [2, due];
  };
  const ranked = items.map((item) => ({ item, rank: rank(item) }));
  // Array sort is stable, so new Concepts keep the order given.
  ranked.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1]);

  const picked: ConceptCards[] = [];
  let cardCount = 0;
  for (const { item, rank } of ranked) {
    if (cardCount >= maxCards) break;
    const cards = rank[0] === 0 ? item.cards.filter((card) => isCardDue(card, now)) : item.cards;
    picked.push({ ...item, cards });
    cardCount += cards.length;
  }
  return picked;
}

/** Whether a Card needs practice by `at`: it's due, or it hasn't been practised yet. */
function isCardDue(card: Card, at: Date): boolean {
  return card.srs.state === State.New || card.srs.due.getTime() <= at.getTime();
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
 * Whether a started Concept needs practice by `at`: one of its Cards is due, or one hasn't been
 * practised yet. A session picks these first. New Concepts are never due.
 */
export function isConceptDue(cards: Card[], at: Date): boolean {
  const started = cards.filter((card) => card.srs.state !== State.New);
  if (started.length === 0) return false;
  return cards.some((card) => isCardDue(card, at));
}

/**
 * How many of the Concepts need practice by the end of the day of `now`, in local time, with their
 * Subject's Exercise Types.
 */
export function countDueToday(
  conceptIds: string[],
  cards: Record<string, Card>,
  now: Date,
  exerciseTypes = EXERCISE_TYPES,
): number {
  const endOfDay = new Date(now);
  endOfDay.setHours(24, 0, 0, 0);
  return conceptIds.filter((conceptId) =>
    isConceptDue(getConceptCards(conceptId, cards, now, exerciseTypes), endOfDay),
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

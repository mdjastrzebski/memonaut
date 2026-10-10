import type { Card, Concept, Deck, ExerciseType, Review } from '@/domain/types';
import type { AnswerIssue } from '@/exercises/type-answer';
import { createSrsCard, reviewSrsCard, State, type Grade } from '@/srs/scheduler';

/**
 * Cards due again within this window come back in the same session, like Anki's learn-ahead limit.
 * This lets a new card go through its learning steps (1m, 10m) and graduate to Review.
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/** Every Exercise Type, easiest first. A session practises each Concept with all of them. */
export const EXERCISE_TYPES: ExerciseType[] = ['dictation', 'translation'];

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
  /** Practise at most this many Concepts, picked with `pickConcepts`. All of them if left out. */
  maxConcepts?: number;
  /** Easiest first: all Cards of one type are queued before any Card of the next. */
  exerciseTypes?: ExerciseType[];
  now?: Date;
  random?: () => number;
}

export function createSession({
  deck,
  concepts,
  cards: previous = {},
  maxConcepts = Infinity,
  exerciseTypes = EXERCISE_TYPES,
  now = new Date(),
  random = Math.random,
}: CreateSessionOptions): Session {
  const conceptCards = (concept: Concept) =>
    exerciseTypes.map((exerciseType): Card => {
      const id = getCardId(concept.id, exerciseType);
      return previous[id] ?? { id, conceptId: concept.id, exerciseType, srs: createSrsCard(now) };
    });
  const deckConcepts = pickConcepts(
    concepts
      .filter((concept) => deck.conceptIds.includes(concept.id))
      .map((concept) => ({ concept, cards: conceptCards(concept) })),
    maxConcepts,
    now,
  );
  // Grouped by Exercise Type so the queue below can keep them in order.
  const cards = exerciseTypes.flatMap((_, index) => deckConcepts.map(({ cards }) => cards[index]));

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
 * Picks up to `max` Concepts to practise, in this order:
 * 1. started ones that are due, or whose other exercises haven't been practised yet, most overdue
 *    first
 * 2. new ones, in Deck order
 * 3. the rest, soonest due first
 */
function pickConcepts(items: ConceptCards[], max: number, now: Date): ConceptCards[] {
  const rank = ({ cards }: ConceptCards): [group: number, due: number] => {
    const started = cards.filter((card) => card.srs.state !== State.New);
    if (started.length === 0) return [1, 0];
    const due = Math.min(...started.map((card) => card.srs.due.getTime()));
    return started.length < cards.length || due <= now.getTime() ? [0, due] : [2, due];
  };
  const ranked = items.map((item) => ({ item, rank: rank(item) }));
  // Array sort is stable, so new Concepts keep their Deck order.
  ranked.sort((a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1]);
  return ranked.slice(0, max).map(({ item }) => item);
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

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

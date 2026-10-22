import type {
  Card,
  Concept,
  Deck,
  ExerciseType,
  Review,
  Subject,
  SubjectKind,
} from '@/domain/types';
import { getGermanNoun, isGerman } from '@/exercises/german-articles';
import type { AnswerIssue } from '@/exercises/type-answer';
import { shuffle } from '@/lib/shuffle';
import { getCardEffort, getReviewEffort, INTRO_EFFORT } from '@/session/effort';
import {
  createSrsCard,
  getRetrievability,
  Rating,
  reviewSrsCard,
  State,
  type Grade,
} from '@/srs/scheduler';

/**
 * Cards due again within this window come back in the same session, like Anki's learn-ahead limit.
 * This lets a new card go through its learning steps (1m, 10m) and graduate to Review.
 */
export const LEARN_AHEAD_MS = 20 * 60 * 1000;

/**
 * How many exercises come between a new word's intro and its first exercise, so that exercise asks
 * to recall the word rather than echo what's still on screen.
 */
export const INTRO_GAP = 2;

/**
 * A word is tricky, like Anki's leeches but sooner, once one of its Cards was forgotten this many
 * times after it was learned, or reached `TRICKY_DIFFICULTY`.
 */
export const TRICKY_LAPSES = 2;

/** FSRS difficulty, 1–10, of a tricky word's Card: about three misses in a row, or two lapses. */
export const TRICKY_DIFFICULTY = 9;

/**
 * A Card missed this many times in a session leaves it, rather than come back again and again
 * moments later. It stays due, so the next session asks it first.
 */
export const MAX_SESSION_MISSES = 2;

/**
 * How long a Card that left the session for being missed `MAX_SESSION_MISSES` times waits at least,
 * so a session started right after doesn't begin with the same words again.
 */
export const MISSED_CARD_DELAY_MS = 3 * 60 * 60 * 1000;

/** Every Exercise Type, easiest first. A Concept unlocks them one at a time, in a Deck's order. */
export const EXERCISE_TYPES: ExerciseType[] = [
  'recognition-choice',
  'translation-choice',
  'article-choice-de',
  'dictation',
  'cloze',
  'translation',
  'plural-form',
  'translation-plural',
  'question-choice',
  'question-type',
];

/** The Exercise Types each kind of Subject can use, easiest first. */
export const KIND_EXERCISE_TYPES: Record<SubjectKind, ExerciseType[]> = {
  language: [
    'recognition-choice',
    'translation-choice',
    'article-choice-de',
    'dictation',
    'cloze',
    'translation',
    'plural-form',
    'translation-plural',
  ],
  knowledge: ['question-choice', 'question-type'],
};

/**
 * Whether a Concept can be practised with an Exercise Type: question choice needs choices, German
 * article choice a German singular noun with its article, dieser, ein, kein or a possessive, e.g.
 * "das Buch" or "meine Tasche", plural form a foreign plural, and translation plural both plurals.
 * A cloze sentence is practised only with cloze.
 */
export function canPractise(
  concept: Concept,
  exerciseType: ExerciseType,
  subject: Subject,
): boolean {
  if ((concept.kind === 'cloze') !== (exerciseType === 'cloze')) return false;
  switch (exerciseType) {
    case 'question-choice':
      return concept.kind === 'knowledge' && !!concept.choices;
    case 'article-choice-de':
      return concept.kind === 'language' && isGerman(subject) && !!getGermanNoun(concept);
    case 'plural-form':
      return concept.kind === 'language' && !!concept.foreignPlural;
    case 'translation-plural':
      return concept.kind === 'language' && !!concept.foreignPlural && !!concept.localPlural;
    default:
      return true;
  }
}

/** How a Concept is practised in a Deck, easiest first. */
export function getConceptExerciseTypes(deck: Deck, conceptId: string): ExerciseType[] {
  return deck.conceptExerciseTypes?.[conceptId] ?? deck.exerciseTypes;
}

/**
 * The Deck practised with only some of its Exercise Types, e.g. to try one out. Concepts left with
 * none are left out. Exercise Types not in the Deck are ignored, and with none of its own left, the
 * Deck stays as it is.
 */
export function withExerciseTypes(deck: Deck, exerciseTypes: ExerciseType[]): Deck {
  const keep = (types: ExerciseType[]) => types.filter((type) => exerciseTypes.includes(type));
  if (keep(deck.exerciseTypes).length === 0) return deck;
  const conceptExerciseTypes = Object.fromEntries(
    deck.conceptIds.map((conceptId) => [conceptId, keep(getConceptExerciseTypes(deck, conceptId))]),
  );
  return {
    ...deck,
    exerciseTypes: keep(deck.exerciseTypes),
    conceptIds: deck.conceptIds.filter((conceptId) => conceptExerciseTypes[conceptId].length > 0),
    conceptExerciseTypes,
  };
}

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
  /**
   * New words still to introduce: ids of Concepts shown with their meaning and read aloud before
   * their first exercise. An intro isn't a Card: it's never scheduled, and a word left without its
   * first answer is introduced again next time, as it's still new.
   */
  intros: string[];
  /** Ids of the Concepts introduced so far. */
  introduced: string[];
  /**
   * Ids of the tricky Concepts picked, in a Deck that shows intros. One is still asked first, so its answer shows what's
   * remembered, and introduced again only once it's missed, before it's asked again.
   */
  tricky: string[];
  reviews: Review[];
  /** Effort points the picked Cards were expected to take. */
  effort: number;
}

interface CreateSessionOptions {
  deck: Deck;
  concepts: Concept[];
  /** Cards practised before, keyed by id. They keep their review state; the rest start new. */
  cards?: Record<string, Card>;
  /** Practise at most this many Cards, picked in the order of `Step`. Everything if left out. */
  maxCards?: number;
  /**
   * Practise Cards, in the order of `Step`, while their expected effort points fit in this many,
   * but at least one. It decides only how many are picked, never which come first, except that
   * new Cards left out for room are added anyway, up to `minNew`.
   */
  maxEffort?: number;
  /**
   * Start at least this many new Cards while there are some left, even if they don't fit: new
   * Concepts and the next unlocked Exercise Types of started ones, even those held back, as
   * `pickNewCards` splits them.
   */
  minNew?: number;
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
  /**
   * A new Concept's first Exercise Type, in Deck order, or for a Deck with `shuffleNew` shuffled,
   * its priority Concepts first.
   */
  New: 2,
  /** Due, but another Card of the Concept is practised today. Most overdue first. */
  HeldDue: 3,
  /** Unlocked, but another Card of the Concept is practised today. Same order as `Unlocked`. */
  HeldUnlocked: 4,
  /** Not due yet, but in Review, reviewed ahead. Soonest due first. */
  Ahead: 5,
} as const;
type Step = (typeof Step)[keyof typeof Step];

export function createSession({
  deck,
  concepts,
  cards: previous = {},
  maxCards = Infinity,
  maxEffort = Infinity,
  minNew = 1,
  now = new Date(),
  random = Math.random,
}: CreateSessionOptions): Session {
  // Easiest first: all Cards of one type are queued before any Card of the next.
  const { exerciseTypes } = deck;
  const deckConcepts = deck.conceptIds.flatMap((conceptId) => {
    const concept = concepts.find((concept) => concept.id === conceptId);
    return concept ? [concept] : [];
  });
  const conceptCards = (conceptId: string) =>
    getConceptCards(conceptId, previous, now, getConceptExerciseTypes(deck, conceptId));
  const newConceptIds = deckConcepts
    .map((concept) => concept.id)
    .filter((conceptId) => conceptCards(conceptId).every((card) => card.srs.state === State.New));
  const isPriority = (conceptId: string) => deck.priorityConceptIds?.includes(conceptId);
  const newOrder = deck.shuffleNew
    ? [
        ...shuffle(newConceptIds.filter(isPriority), random),
        ...shuffle(
          newConceptIds.filter((conceptId) => !isPriority(conceptId)),
          random,
        ),
      ]
    : newConceptIds;

  const candidates = deckConcepts.flatMap((concept, conceptIndex) =>
    getCandidates(conceptCards(concept.id), now, now).map(({ card, step }) => {
      const typeIndex = exerciseTypes.indexOf(card.exerciseType);
      const sortKey =
        step === Step.Unlocked || step === Step.HeldUnlocked
          ? [typeIndex, conceptIndex]
          : step === Step.New
            ? [newOrder.indexOf(concept.id), 0]
            : [card.srs.due.getTime(), conceptIndex];
      // A new Concept is introduced before its first exercise, so it isn't first met in a guess,
      // unless the Deck doesn't show intros.
      const showIntro = deck.showIntro !== false;
      const intro = showIntro && step === Step.New;
      const tricky = showIntro && isTricky(conceptCards(concept.id));
      const effort = getCardEffort(card, now) + (intro ? INTRO_EFFORT : 0);
      return { concept, card, step, intro, tricky, effort, sortKey: [step, ...sortKey] };
    }),
  );
  candidates.sort((a, b) => compareKeys(a.sortKey, b.sortKey));
  const startedShare =
    deckConcepts.length === 0 ? 0 : 1 - newConceptIds.length / deckConcepts.length;
  const picked = pickWithinEffort(candidates.slice(0, maxCards), maxEffort, minNew, startedShare);
  const pickedConceptIds = (filter: (candidate: (typeof picked)[number]) => boolean) => [
    ...new Set(picked.filter(filter).map(({ concept }) => concept.id)),
  ];
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
    intros: pickedConceptIds(({ intro }) => intro),
    introduced: [],
    tricky: pickedConceptIds(({ tricky }) => tricky),
    reviews: [],
    effort: picked.reduce((total, { effort }) => total + effort, 0),
  };
}

/**
 * The leading candidates whose expected effort fits in `maxEffort`, at least one, and so that
 * reviews never crowd out learning, `minNew` new Cards while there are some left, even if they
 * don't fit.
 */
function pickWithinEffort<T extends { step: Step; effort: number }>(
  candidates: T[],
  maxEffort: number,
  minNew: number,
  startedShare: number,
): T[] {
  const picked = takeWithinEffort(candidates, maxEffort);
  const newCards = pickNewCards(candidates, minNew, startedShare);
  return [...picked, ...newCards.filter((candidate) => !picked.includes(candidate))];
}

/**
 * The least share of new Cards that go deeper, while there are some: a third, e.g. 2 of 6 in 10
 * minutes, so that a wide Deck still moves on to harder Exercise Types.
 */
export const MIN_DEEPER_SHARE = 1 / 3;

/**
 * `count` Cards not practised yet, split between going wider, with new Concepts, and deeper, with
 * the next Exercise Type of started ones, held back or not. Wider first: the deeper share grows
 * with the share of the Deck's Concepts started, from `MIN_DEEPER_SHARE`. When one kind runs
 * short, the other makes up for it.
 */
function pickNewCards<T extends { step: Step }>(
  candidates: T[],
  count: number,
  startedShare: number,
): T[] {
  const wider = candidates.filter(({ step }) => step === Step.New);
  const deeper = candidates.filter(
    ({ step }) => step === Step.Unlocked || step === Step.HeldUnlocked,
  );

  const deeperWanted = Math.floor(count * Math.max(MIN_DEEPER_SHARE, startedShare));
  const deeperCount = Math.min(deeper.length, Math.max(deeperWanted, count - wider.length));
  const widerCount = Math.min(wider.length, count - deeperCount);
  return [...wider.slice(0, widerCount), ...deeper.slice(0, deeperCount)];
}

/** The leading candidates whose expected effort fits in `maxEffort`, at least one. */
function takeWithinEffort<T extends { effort: number }>(candidates: T[], maxEffort: number) {
  let total = 0;
  const count = candidates.findIndex(({ effort }) => {
    total += effort;
    return total > maxEffort;
  });
  return count === -1 ? candidates : candidates.slice(0, Math.max(count, 1));
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
    // Only a learned Card is reviewed ahead: one still learning waits, e.g. after being missed.
    if (card.srs.state === State.Review) return [{ card, step: Step.Ahead }];
    return [];
  });
}

/**
 * Whether a word keeps being forgotten or missed: one of its Cards lapsed `TRICKY_LAPSES` times or
 * reached `TRICKY_DIFFICULTY`.
 */
export function isTricky(cards: Card[]): boolean {
  return cards.some(
    (card) =>
      card.srs.state !== State.New &&
      (card.srs.lapses >= TRICKY_LAPSES || card.srs.difficulty >= TRICKY_DIFFICULTY),
  );
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
 * How many of the Deck's Concepts need practice before the next study day starts: those with a
 * Card a session would pick as due or unlocked. New Concepts and Cards held back for today don't
 * count.
 */
export function countDueToday(deck: Deck, cards: Record<string, Card>, now: Date): number {
  const nextDayStart = getDayStart(now);
  nextDayStart.setDate(nextDayStart.getDate() + 1);
  return deck.conceptIds.filter((conceptId) => {
    const conceptCards = getConceptCards(
      conceptId,
      cards,
      now,
      getConceptExerciseTypes(deck, conceptId),
    );
    return getCandidates(conceptCards, now, nextDayStart).some(
      ({ step }) => step === Step.Due || step === Step.Unlocked,
    );
  }).length;
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
 * The word to introduce before the current Card, if it's still to be introduced: a new one, or a
 * tricky one just missed.
 */
export function getCurrentIntro(session: Session): Concept | undefined {
  const card = getCurrentCard(session);
  return card && session.intros.includes(card.conceptId)
    ? session.concepts[card.conceptId]
    : undefined;
}

/**
 * Marks the current word as introduced and moves its Card back by `INTRO_GAP` exercises, which may
 * be other words' intros.
 */
export function introduce(session: Session): Session {
  const intro = getCurrentIntro(session);
  if (!intro) return session;
  const [cardId, ...rest] = session.queue;
  return {
    ...session,
    queue: [...rest.slice(0, INTRO_GAP), cardId, ...rest.slice(INTRO_GAP)],
    intros: session.intros.filter((conceptId) => conceptId !== intro.id),
    introduced: [...session.introduced, intro.id],
  };
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

/** Effort points of the answers given and the words introduced so far. */
export function getEffortDone(session: Session): number {
  return session.reviews.reduce(
    (total, review) => total + getReviewEffort(review, session.cards[review.cardId].exerciseType),
    session.introduced.length * INTRO_EFFORT,
  );
}

export interface SubmitReviewInput {
  input: string;
  elapsedMs: number;
  rating: Grade;
  issues: AnswerIssue[];
  now: Date;
}

/**
 * The rating an answer to a Card is scheduled with. An answer to a word introduced in the session,
 * new or tricky, counts as Good at most while its Card is still learning: picking it fast moments
 * after seeing it doesn't show it's easy to remember.
 */
export function getScheduledGrade(session: Session, card: Card, grade: Grade): Grade {
  const justIntroduced =
    session.introduced.includes(card.conceptId) && card.srs.state !== State.Review;
  return justIntroduced && grade === Rating.Easy ? Rating.Good : grade;
}

/** How many times a Card was missed in the session so far. */
function countMisses(session: Session, cardId: string): number {
  return session.reviews.filter(
    (review) => review.cardId === cardId && review.rating === Rating.Again,
  ).length;
}

/**
 * Whether answering the current Card with `grade` ends its practice in the session, even if it's
 * due again soon: an almost-right answer, fixed right away, or its `MAX_SESSION_MISSES`th miss.
 */
export function isLastTry(session: Session, grade: Grade): boolean {
  const card = getCurrentCard(session);
  if (!card) return false;
  return (
    grade === Rating.Hard ||
    (grade === Rating.Again && countMisses(session, card.id) + 1 >= MAX_SESSION_MISSES)
  );
}

/**
 * Applies a review to the current Card, with the rating it's scheduled with, and moves it to the
 * end of the queue if it's due again soon, unless that was its last try in the session. A tricky
 * word missed is introduced again before that, once per session. A Card leaving after its last
 * miss waits `MISSED_CARD_DELAY_MS` before it's due again.
 */
export function submitReview(session: Session, { now, ...input }: SubmitReviewInput): Session {
  const card = getCurrentCard(session);
  if (!card) {
    return session;
  }

  const answer = { ...input, rating: getScheduledGrade(session, card, input.rating) };
  const { card: scheduled, log } = reviewSrsCard(card.srs, answer.rating, now);
  const lastTry = isLastTry(session, answer.rating);
  const waitUntil = now.getTime() + MISSED_CARD_DELAY_MS;
  const srsAfter =
    lastTry && answer.rating === Rating.Again && scheduled.due.getTime() < waitUntil
      ? { ...scheduled, due: new Date(waitUntil) }
      : scheduled;
  const dueSoon = srsAfter.due.getTime() - now.getTime() <= LEARN_AHEAD_MS && !lastTry;
  const rest = session.queue.slice(1);
  const reintroduce =
    dueSoon &&
    answer.rating === Rating.Again &&
    session.tricky.includes(card.conceptId) &&
    !session.introduced.includes(card.conceptId) &&
    !session.intros.includes(card.conceptId);

  return {
    ...session,
    cards: { ...session.cards, [card.id]: { ...card, srs: srsAfter } },
    queue: dueSoon ? [...rest, card.id] : rest,
    intros: reintroduce ? [...session.intros, card.conceptId] : session.intros,
    reviews: [
      ...session.reviews,
      { cardId: card.id, ...answer, earnedRating: input.rating, log, srsAfter },
    ],
  };
}

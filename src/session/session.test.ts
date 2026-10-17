import { expect, test } from 'vitest';

import type { Card, Concept, Deck, ExerciseType } from '@/domain/types';
import {
  createSrsCard,
  Rating,
  reviewSrsCard,
  State,
  type FsrsCard,
  type Grade,
} from '@/srs/scheduler';

import {
  countDueToday,
  createSession,
  getCurrentCard,
  getCurrentIntro,
  getEffortDone,
  getScheduledGrade,
  getSessionProgress,
  introduce,
  submitReview,
  withExerciseTypes,
  type Session,
} from './session';

const concepts: Concept[] = [
  { id: 'one', subjectId: 'german', kind: 'language', local: 'jeden', foreign: 'eins' },
  { id: 'two', subjectId: 'german', kind: 'language', local: 'dwa', foreign: 'zwei' },
];
const deck: Deck = {
  id: 'numbers',
  subjectId: 'german',
  kind: 'unit',
  name: 'Numbers',
  conceptIds: ['one', 'two'],
  exerciseTypes: ['dictation', 'translation'],
};
const start = new Date('2026-01-01T10:00:00Z');
const minutes = (n: number) => new Date(start.getTime() + n * 60_000);

function create() {
  return createSession({
    deck: { ...deck, exerciseTypes: ['translation'] },
    concepts,
    now: start,
    random: () => 0.99,
  });
}

/** A Card answered Easy at `at`, so it graduated to Review, with any SRS state overridden. */
function reviewed(id: string, at: Date, srs: Partial<FsrsCard> = {}): Card {
  const [conceptId, exerciseType] = id.split(':') as [string, ExerciseType];
  const { card } = reviewSrsCard(createSrsCard(at), Rating.Easy, at);
  return { id, conceptId, exerciseType, srs: { ...card, ...srs } };
}

function byId(...cards: Card[]): Record<string, Card> {
  return Object.fromEntries(cards.map((card) => [card.id, card]));
}

/** The ids of the Cards a session picks, grouped by Exercise Type. */
function pick(cards: Record<string, Card>, now: Date, maxCards?: number, sessionDeck = deck) {
  return Object.keys(createSession({ deck: sessionDeck, concepts, cards, maxCards, now }).cards);
}

const nextDay = (date: Date) => new Date(date.getTime() + 24 * 60 * 60_000);

test('starts a new concept with its first exercise type only', () => {
  const session = createSession({ deck, concepts, now: start });
  expect(Object.keys(session.concepts)).toEqual(['one', 'two']);
  expect(Object.keys(session.cards)).toEqual(['one:dictation', 'two:dictation']);
  expect(Object.values(session.cards).every((card) => card.srs.state === State.New)).toBe(true);
});

test('practises at most the given number of cards', () => {
  expect(pick({}, start, 1)).toEqual(['one:dictation']);
});

test('keeps the review state of cards practised in an earlier session', () => {
  const earlier = submitReview(create(), {
    input: 'x',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Again,
    now: start,
  });
  const [practised] = earlier.queue.slice(-1);

  const session = createSession({ deck, concepts, cards: earlier.cards, now: minutes(30) });
  expect(session.cards[practised]).toBe(earlier.cards[practised]);
});

test('unlocks the next exercise type once the previous card graduates', () => {
  // Still learning: translation stays locked.
  const learning = byId({
    ...reviewed('one:dictation', start),
    srs: reviewSrsCard(createSrsCard(start), Rating.Good, start).card,
  });
  expect(pick(learning, nextDay(start))).toEqual(['one:dictation', 'two:dictation']);

  // Graduated: on the next day, translation comes before the new word.
  const graduated = byId(reviewed('one:dictation', start));
  expect(pick(graduated, nextDay(start), 1)).toEqual(['one:translation']);
});

test('holds back other exercise types of a word practised today, using them only to fill room', () => {
  const cards = byId(reviewed('one:dictation', start));
  // New words come first.
  expect(pick(cards, minutes(30), 1)).toEqual(['two:dictation']);
  // With room left, the held-back translation joins.
  expect(pick(cards, minutes(30), 2)).toEqual(['two:dictation', 'one:translation']);
});

test('a study day starts at 4 AM local time', () => {
  const lateEvening = new Date(2026, 0, 1, 23, 30);
  const cards = byId(reviewed('one:dictation', lateEvening));
  // Past midnight is still the same study day, so the new word comes first.
  expect(pick(cards, new Date(2026, 0, 2, 0, 15), 1)).toEqual(['two:dictation']);
  expect(pick(cards, new Date(2026, 0, 2, 4, 15), 1)).toEqual(['one:translation']);
});

test('practises the due type most likely forgotten, holding the other back', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  const cards = byId(
    reviewed('one:dictation', lastWeek, { stability: 30, due: start }),
    reviewed('one:translation', lastWeek, { stability: 3, due: start }),
  );
  expect(pick(cards, start, 1)).toEqual(['one:translation']);
  // The new word comes before the held-back dictation.
  expect(pick(cards, start, 2)).toEqual(['two:dictation', 'one:translation']);
  expect(pick(cards, start, 3)).toEqual(['two:dictation', 'one:dictation', 'one:translation']);
});

test('keeps every exercise type already started, picking due ones first', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  // Started before exercise types were unlocked one at a time.
  const cards = byId(
    reviewed('two:dictation', lastWeek, { due: nextDay(start) }),
    reviewed('two:translation', lastWeek, { due: start }),
  );
  expect(pick(cards, start, 1)).toEqual(['two:translation']);
});

test('picks new concepts in deck order, or shuffled for a deck with shuffleNew', () => {
  const pickNew = (deck: Deck) =>
    Object.keys(
      createSession({ deck, concepts, maxCards: 1, now: start, random: () => 0 }).concepts,
    );
  expect(pickNew(deck)).toEqual(['one']);
  expect(pickNew({ ...deck, shuffleNew: true })).toEqual(['two']);
});

test('reviews ahead with the room left, queuing every dictation before the translations', () => {
  const cards = byId(reviewed('one:dictation', start), reviewed('two:dictation', start));
  for (const value of [0, 0.5, 0.99]) {
    const session = createSession({
      deck,
      concepts,
      cards,
      now: nextDay(start),
      random: () => value,
    });
    expect(session.queue.map((id) => session.cards[id].exerciseType)).toEqual([
      'dictation',
      'dictation',
      'translation',
      'translation',
    ]);
  }
});

test('learning card returns to the end of the queue', () => {
  let session = create();
  const first = getCurrentCard(session)!;

  session = submitReview(session, {
    input: 'x',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Again,
    now: start,
  });

  expect(session.cards[first.id].srs.state).toBe(State.Learning);
  expect(session.queue).toEqual([expect.not.stringMatching(first.id), first.id]);
  expect(session.reviews).toHaveLength(1);
  expect(session.reviews[0].log.state).toBe(State.New);
});

test('card leaves the session once it graduates to review', () => {
  let session = create();
  const first = getCurrentCard(session)!;

  // New → Learning (10m step), then Learning → Review (days).
  session = submitReview(session, {
    input: 'a',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Good,
    now: start,
  });
  session = submitReview(session, {
    input: 'b',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Easy,
    now: start,
  });
  session = submitReview(session, {
    input: 'a',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Good,
    now: minutes(1),
  });

  expect(session.cards[first.id].srs.state).toBe(State.Review);
  expect(session.queue).not.toContain(first.id);
  expect(session.queue).toHaveLength(0);
});

test('progress counts answered cards half and finished cards fully', () => {
  let session = create();
  expect(getSessionProgress(session)).toBe(0);

  const review = (rating: Grade) =>
    (session = submitReview(session, {
      input: 'x',
      elapsedMs: 1000,
      issues: [],
      rating,
      now: start,
    }));

  // Answered but still queued.
  review(Rating.Again);
  expect(getSessionProgress(session)).toBe(0.25);

  // Easy on a new card graduates it straight to review.
  review(Rating.Easy);
  expect(getSessionProgress(session)).toBe(0.75);
});

test('counts words due before the next study day, or with an exercise type unlocked', () => {
  const yesterday = new Date(2026, 0, 1, 8);
  const morning = new Date(2026, 0, 2, 8);
  const cards = byId(
    // Due tonight.
    reviewed('one:dictation', yesterday, { due: new Date(2026, 0, 2, 23) }),
    reviewed('one:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Translation unlocked.
    reviewed('two:dictation', yesterday, { due: new Date(2026, 0, 6) }),
    // Due after midnight, still before the next study day starts at 4 AM.
    reviewed('three:dictation', yesterday, { due: new Date(2026, 0, 3, 3) }),
    reviewed('three:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Due after the next study day starts.
    reviewed('four:dictation', yesterday, { due: new Date(2026, 0, 3, 5) }),
    reviewed('four:translation', yesterday, { due: new Date(2026, 0, 6) }),
    // Practised today, so its unlocked translation waits until tomorrow.
    reviewed('five:dictation', new Date(2026, 0, 2, 7)),
  );
  const conceptIds = ['one', 'two', 'three', 'four', 'five', 'six'];
  const withTypes = (exerciseTypes: ExerciseType[]) => ({ ...deck, conceptIds, exerciseTypes });

  expect(countDueToday(withTypes(['dictation', 'translation']), cards, morning)).toBe(3);
  // Without translation exercises, nothing gets unlocked.
  expect(countDueToday(withTypes(['dictation']), cards, morning)).toBe(2);
  // Nor for a word practised with fewer of the deck's exercise types.
  const conceptExerciseTypes = { two: ['dictation'] as ExerciseType[] };
  expect(
    countDueToday(
      { ...withTypes(['dictation', 'translation']), conceptExerciseTypes },
      cards,
      morning,
    ),
  ).toBe(2);
});

test('picks cards in the usual order while their effort fits, but at least one', () => {
  // A new card's dictation is 2 points, answered twice, and its word's intro half a point: 4.5
  // points each.
  expect(pick({}, start, undefined, deck)).toEqual(['one:dictation', 'two:dictation']);
  expect(Object.keys(createSession({ deck, concepts, maxEffort: 9, now: start }).cards)).toEqual([
    'one:dictation',
    'two:dictation',
  ]);
  expect(Object.keys(createSession({ deck, concepts, maxEffort: 8, now: start }).cards)).toEqual([
    'one:dictation',
  ]);
  expect(Object.keys(createSession({ deck, concepts, maxEffort: 1, now: start }).cards)).toEqual([
    'one:dictation',
  ]);
});

test('introduces a new word even when due cards take up all the effort', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  const cards = byId(reviewed('one:dictation', lastWeek, { due: start }));
  const session = createSession({ deck, concepts, cards, maxEffort: 1, now: start });
  expect(Object.keys(session.cards)).toEqual(['one:dictation', 'two:dictation']);
  expect(session.intros).toEqual(['two']);
  // The new word comes on top of every due card that fits.
  const three: Concept[] = [
    ...concepts,
    { id: 'three', subjectId: 'german', kind: 'language', local: 'trzy', foreign: 'drei' },
  ];
  const twoDue = byId(cards['one:dictation'], reviewed('two:dictation', lastWeek, { due: start }));
  expect(
    Object.keys(
      createSession({
        deck: { ...deck, conceptIds: ['one', 'two', 'three'] },
        concepts: three,
        cards: twoDue,
        maxEffort: 8,
        now: start,
      }).cards,
    ),
  ).toEqual(['one:dictation', 'two:dictation', 'three:dictation']);
  // With every word started, nothing new is added.
  const started = byId(
    cards['one:dictation'],
    reviewed('two:dictation', lastWeek, { due: nextDay(start) }),
  );
  expect(
    Object.keys(createSession({ deck, concepts, cards: started, maxEffort: 1, now: start }).cards),
  ).toEqual(['one:dictation']);
});

test('fits fewer typed exercises than multiple choice ones in the same effort', () => {
  const count = (exerciseTypes: ExerciseType[]) =>
    Object.keys(
      createSession({ deck: { ...deck, exerciseTypes }, concepts, maxEffort: 5, now: start }).cards,
    ).length;
  expect(count(['recognition-choice'])).toBe(2);
  expect(count(['translation'])).toBe(1);
});

test('tells the effort planned and the effort of the answers given', () => {
  const session = createSession({ deck, concepts, now: start });
  expect(session.effort).toBe(9);
  const answered = submitReview(session, {
    input: 'eins',
    elapsedMs: 1000,
    issues: [],
    rating: Rating.Good,
    now: start,
  });
  expect(getEffortDone(answered)).toBe(2);
  expect(getEffortDone(introduce(answered))).toBe(2.5);
});

test('introduces each new word before its first card, a couple of exercises ahead', () => {
  const three: Concept[] = [
    ...concepts,
    { id: 'three', subjectId: 'german', kind: 'language', local: 'trzy', foreign: 'drei' },
  ];
  let session = createSession({
    deck: { ...deck, conceptIds: ['one', 'two', 'three'] },
    concepts: three,
    now: start,
    random: () => 0.99,
  });
  expect(session.intros).toEqual(['one', 'two', 'three']);

  // Shows the intro or the exercise in front, and moves on past it.
  const steps: string[] = [];
  while (getCurrentCard(session)) {
    const intro = getCurrentIntro(session);
    steps.push(intro ? `intro ${intro.id}` : getCurrentCard(session)!.id);
    session = intro
      ? introduce(session)
      : { ...session, queue: session.queue.slice(1), reviews: session.reviews };
  }
  expect(steps).toEqual([
    'intro one',
    'intro two',
    'intro three',
    'one:dictation',
    'two:dictation',
    'three:dictation',
  ]);
  expect(session.introduced).toEqual(['one', 'two', 'three']);
});

test('introduces only new concepts, not started ones, in a deck that shows intros', () => {
  const cards = byId(reviewed('one:dictation', start));
  expect(createSession({ deck, concepts, cards, now: nextDay(start) }).intros).toEqual(['two']);

  const questions: Concept[] = [
    { id: 'square-3', subjectId: 'math', kind: 'knowledge', question: '3² =', answer: '9' },
  ];
  const quiz: Deck = {
    ...deck,
    subjectId: 'math',
    conceptIds: ['square-3'],
    exerciseTypes: ['question-type'],
  };
  expect(createSession({ deck: quiz, concepts: questions, now: start }).intros).toEqual([
    'square-3',
  ]);
  const noIntro = { ...quiz, showIntro: false };
  expect(createSession({ deck: noIntro, concepts: questions, now: start }).intros).toEqual([]);
  expect(
    createSession({ deck: { ...deck, showIntro: false }, concepts, now: start }).intros,
  ).toEqual([]);
});

test('asks a tricky word first, and introduces it again once it is missed', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  const cards = byId(
    reviewed('one:dictation', lastWeek, { due: start, lapses: 2 }),
    reviewed('two:dictation', lastWeek, { due: start, lapses: 1 }),
  );
  const answer = (session: Session, rating: Grade) =>
    submitReview(session, { input: '', elapsedMs: 1000, issues: [], rating, now: start });
  let session = createSession({
    deck: { ...deck, conceptIds: ['one'] },
    concepts,
    cards,
    now: start,
  });
  expect(session.tricky).toEqual(['one']);
  // Not introduced before it's asked, as that would give the answer away.
  expect(session.intros).toEqual([]);

  session = answer(session, Rating.Again);
  expect(getCurrentIntro(session)?.id).toBe('one');
  session = introduce(session);
  expect(getCurrentCard(session)?.id).toBe('one:dictation');
  // Asked again right after its intro, it can't be rated Easy.
  session = answer(session, Rating.Easy);
  expect(session.reviews[1].rating).toBe(Rating.Good);
  // Missed again, it isn't introduced a second time.
  session = answer({ ...session, queue: ['one:dictation'] }, Rating.Again);
  expect(session.intros).toEqual([]);

  // A word missed but not tricky isn't introduced again.
  const both = createSession({ deck, concepts, cards, now: start });
  expect(both.tricky).toEqual(['one']);
  const twoFirst = { ...both, queue: ['two:dictation', 'one:dictation'] };
  expect(answer(twoFirst, Rating.Again).intros).toEqual([]);
});

test('a word is tricky once missed again and again, in a deck that shows intros', () => {
  const lastWeek = new Date(start.getTime() - 7 * 24 * 60 * 60_000);
  const missed = byId(reviewed('two:dictation', lastWeek, { due: start, difficulty: 9.6 }));
  expect(createSession({ deck, concepts, cards: missed, now: start }).tricky).toEqual(['two']);
  const questions: Concept[] = [
    { id: 'square-3', subjectId: 'math', kind: 'knowledge', question: '3² =', answer: '9' },
  ];
  const quiz: Deck = {
    ...deck,
    subjectId: 'math',
    conceptIds: ['square-3'],
    exerciseTypes: ['question-type'],
  };
  const hardQuestion = byId(
    reviewed('square-3:question-type', lastWeek, { due: start, lapses: 3 }),
  );
  expect(
    createSession({ deck: quiz, concepts: questions, cards: hardQuestion, now: start }).tricky,
  ).toEqual(['square-3']);
  const noIntro = { ...quiz, showIntro: false };
  expect(
    createSession({ deck: noIntro, concepts: questions, cards: hardQuestion, now: start }).tricky,
  ).toEqual([]);
});

test('rates the first answer to a word just introduced Good at most', () => {
  const easy = (session: Session) =>
    submitReview(session, {
      input: 'eins',
      elapsedMs: 1000,
      issues: [],
      rating: Rating.Easy,
      now: start,
    });
  const session = createSession({
    deck: { ...deck, conceptIds: ['one'] },
    concepts,
    now: start,
  });
  const [cardId] = session.queue;

  // Without its intro, a fast answer graduates at once.
  expect(easy(session).cards[cardId].srs.state).toBe(State.Review);

  const introduced = introduce(session);
  const answered = easy(introduced);
  expect(answered.reviews[0].rating).toBe(Rating.Good);
  expect(answered.cards[cardId].srs.state).toBe(State.Learning);
  expect(getScheduledGrade(introduced, introduced.cards[cardId], Rating.Hard)).toBe(Rating.Hard);
});

test('a deck can be practised with only some of its exercise types', () => {
  const nouns: Deck = {
    ...deck,
    exerciseTypes: ['dictation', 'article-choice-de', 'translation'],
    conceptExerciseTypes: { two: ['dictation', 'translation'] },
  };
  const articles = withExerciseTypes(nouns, ['article-choice-de']);
  // A new concept starts with the only type left; one without it is left out.
  expect(articles).toMatchObject({ exerciseTypes: ['article-choice-de'], conceptIds: ['one'] });
  expect(pick({}, start, undefined, articles)).toEqual(['one:article-choice-de']);

  expect(withExerciseTypes(nouns, ['translation', 'question-type']).conceptIds).toEqual([
    'one',
    'two',
  ]);
  // With none of the deck's own types, it's practised as it is.
  expect(withExerciseTypes(nouns, ['question-type'])).toBe(nouns);
});

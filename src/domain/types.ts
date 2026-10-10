import type { Card as FsrsCard, Grade, ReviewLog } from 'ts-fsrs';

import type { AnswerIssue } from '@/exercises/type-answer';

/** A separate area of study, e.g. English, German or Przyroda. */
export interface Subject {
  id: string;
  name: string;
  /** Characters offered on the on-screen keyboard, e.g. German umlauts. */
  specialCharacters?: string[];
}

export type DeckKind = 'unit' | 'core';

/** A group of Concepts within a Subject. */
export interface Deck {
  id: string;
  subjectId: string;
  kind: DeckKind;
  name: string;
  conceptIds: string[];
}

/** One piece of knowledge, e.g. a word. It can be in any number of Decks within its Subject. */
export interface Concept {
  id: string;
  subjectId: string;
  /** What the learner sees, e.g. "three". */
  prompt: string;
  /** What the learner should produce, e.g. "drei". */
  answer: string;
  /** Optional extra context shown with the prompt, e.g. "3". */
  hint?: string;
}

/** A way to practise a Concept. */
export type ExerciseType = 'type-answer';

/** One Concept practised with one Exercise Type. It holds its own FSRS review state. */
export interface Card {
  id: string;
  conceptId: string;
  exerciseType: ExerciseType;
  srs: FsrsCard;
}

/** One attempt at a Card. */
export interface Review {
  cardId: string;
  /** What the learner typed. */
  input: string;
  /** Time from showing the exercise to checking the answer. */
  elapsedMs: number;
  /** Rating given automatically from the answer and how fast it was typed. */
  rating: Grade;
  /** Mistakes forgiven in an almost-correct answer rated Hard. */
  issues: AnswerIssue[];
  /** FSRS review log: the Card's memory state before this review. */
  log: ReviewLog;
  /** The Card's memory state after this review. */
  srsAfter: FsrsCard;
}

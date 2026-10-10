import type { Card as FsrsCard, Grade, ReviewLog } from 'ts-fsrs';

import type { AnswerIssue } from '@/exercises/type-answer';

/** A separate area of study, e.g. English, German or Przyroda. */
export interface Subject {
  id: string;
  name: string;
  /** Shown next to the name, e.g. a flag. */
  emoji?: string;
  /** BCP 47 tag of the language being learned, used to read words aloud, e.g. "de-DE". */
  foreignLanguage: string;
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
  /** Unique across Subjects, e.g. "german/number-3". Learning state is keyed by it, so it must not change. */
  id: string;
  subjectId: string;
  /** The word in the learner's own language, e.g. "trzy". */
  local: string;
  /** The word in the language being learned, e.g. "drei". */
  foreign: string;
  /** Optional extra context shown with the word, e.g. "3". */
  hint?: string;
}

/**
 * A way to practise a Concept:
 * - dictation: hear the foreign word and type how it's spelled
 * - translation: see the local word and type the foreign one
 */
export type ExerciseType = 'dictation' | 'translation';

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

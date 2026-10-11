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
  /**
   * How its Concepts can be practised, easiest first, e.g. only dictation for Polish spelling. Its
   * Decks use all of them unless they list fewer.
   */
  exerciseTypes: ExerciseType[];
  /** Spellings marked in a right answer, to remind which ones it got right, e.g. Polish "rz". */
  trickySpellings?: string[];
}

export type DeckKind = 'unit' | 'core';

/** A group of Concepts within a Subject. */
export interface Deck {
  id: string;
  subjectId: string;
  kind: DeckKind;
  name: string;
  conceptIds: string[];
  /**
   * Rates answers strictly, as spelling practice should: only wrong capitalization is forgiven, not
   * missing diacritics (e.g. "zolw" for "żółw") or a letter off ("gura" for "góra").
   */
  strictSpelling?: boolean;
  /** Introduces new Concepts in random order instead of Deck order. */
  shuffleNew?: boolean;
  /** How its Concepts are practised, easiest first: some or all of its Subject's. */
  exerciseTypes: ExerciseType[];
}

/** One piece of knowledge, e.g. a word. It can be in any number of Decks within its Subject. */
export interface Concept {
  /** Unique across Subjects, e.g. "german/number-3". Learning state is keyed by it, so it must not change. */
  id: string;
  subjectId: string;
  /**
   * The word in the learner's own language, e.g. "trzy". Left out where there's nothing to
   * translate, e.g. in Polish spelling, whose Subject has no translation exercises.
   */
  local?: string;
  /** The word in the language being learned, e.g. "drei" or, for Polish spelling, "może". */
  foreign: string;
  /** Optional extra context shown with the word in translation, e.g. "3". */
  hint?: string;
  /**
   * Optional words read aloud after the word in dictation, in the language being learned, to tell
   * apart words that sound the same, e.g. "zbiornik słonej wody" for "morze" (not "może").
   */
  spokenHint?: string;
}

/**
 * A way to practise a Concept:
 * - recognition-choice: see and hear the foreign word and pick the local one from a few options
 * - dictation: hear the foreign word and type how it's spelled
 * - translation-choice: see the local word and pick the foreign one from a few options
 * - translation: see the local word and type the foreign one
 */
export type ExerciseType =
  | 'recognition-choice'
  | 'dictation'
  | 'translation-choice'
  | 'translation';

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

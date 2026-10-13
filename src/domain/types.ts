import type { Card as FsrsCard, Grade, ReviewLog } from 'ts-fsrs';

import type { AnswerIssue } from '@/exercises/type-answer';

/**
 * What a Subject teaches, which decides its Concepts' fields and Exercise Types:
 * - lang: words of a language, e.g. English or Polish spelling, practised both ways
 * - knowledge: questions with an answer, e.g. math, asked one way only
 */
export type SubjectKind = 'lang' | 'knowledge';

/** A separate area of study, e.g. English, German or Przyroda. */
export type Subject = LangSubject | KnowledgeSubject;

interface SubjectBase {
  id: string;
  name: string;
  /** Shown next to the name, e.g. a flag. */
  emoji?: string;
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

export interface LangSubject extends SubjectBase {
  kind: 'lang';
  /** BCP 47 tag of the language being learned, used to read words aloud, e.g. "de-DE". */
  foreignLanguage: string;
}

export interface KnowledgeSubject extends SubjectBase {
  kind: 'knowledge';
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

/**
 * One piece of knowledge, e.g. a word or a question. It can be in any number of Decks within its
 * Subject, and is of its Subject's kind.
 */
export type Concept = LangConcept | KnowledgeConcept;

interface ConceptBase {
  /** Unique across Subjects, e.g. "german/number-3". Learning state is keyed by it, so it must not change. */
  id: string;
  subjectId: string;
}

/** A word of a language Subject. */
export interface LangConcept extends ConceptBase {
  kind: 'lang';
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
  /**
   * Optional name of a set of like Concepts within the Subject, e.g. "weekday", or "number/small"
   * within the wider "number". In multiple choice, the others of its group are offered first as
   * wrong options, then those of each wider group.
   */
  group?: string;
}

/** A question of a knowledge Subject, asked one way only. */
export interface KnowledgeConcept extends ConceptBase {
  kind: 'knowledge';
  /** E.g. "3² =" or "Reszta z dzielenia 29 przez 6". */
  question: string;
  /** Typed exactly, e.g. "9". */
  answer: string;
  /** Optional, shown with the result, e.g. "3² = 9" or "29 : 6 = 4 r 5". */
  explanation?: string;
}

/**
 * A way to practise a Concept:
 * - recognition-choice: see and hear the foreign word and pick the local one from a few options
 * - dictation: hear the foreign word and type how it's spelled
 * - translation-choice: see the local word and pick the foreign one from a few options
 * - translation: see the local word and type the foreign one
 * - question: see a knowledge question and type its answer
 */
export type ExerciseType =
  | 'recognition-choice'
  | 'dictation'
  | 'translation-choice'
  | 'translation'
  | 'question';

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

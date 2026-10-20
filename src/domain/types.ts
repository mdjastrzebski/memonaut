import type { Card as FsrsCard, Grade, ReviewLog } from 'ts-fsrs';

import type { AnswerIssue } from '@/exercises/type-answer';

/**
 * What a Subject teaches, which decides its Concepts' fields and Exercise Types:
 * - language: words of a language, e.g. English or Polish spelling, practised both ways
 * - knowledge: questions with an answer, e.g. math, asked one way only
 */
export type SubjectKind = 'language' | 'knowledge';

/** A separate area of study, e.g. English, German or Przyroda. */
export type Subject = LanguageSubject | KnowledgeSubject;

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

export interface LanguageSubject extends SubjectBase {
  kind: 'language';
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
  /** Concepts introduced before the Deck's other new ones, in a Deck with `shuffleNew`. */
  priorityConceptIds?: string[];
  /**
   * Shows a new Concept, and a tricky one once missed, with its answer before it's asked. True if
   * left out; off for e.g. math, whose questions are worked out rather than remembered.
   */
  showIntro?: boolean;
  /** How its Concepts are practised, easiest first: some or all of its Subject's. */
  exerciseTypes: ExerciseType[];
  /**
   * Fewer Exercise Types, keyed by Concept id, for Concepts that can't be practised with all of
   * the Deck's, e.g. a question without choices.
   */
  conceptExerciseTypes?: Record<string, ExerciseType[]>;
}

/**
 * One piece of knowledge, e.g. a word or a question. It can be in any number of Decks within its
 * Subject, and is of its Subject's kind.
 */
export type Concept = LanguageConcept | KnowledgeConcept | ClozeConcept;

interface ConceptBase {
  /** Unique across Subjects, e.g. "german/number-3". Learning state is keyed by it, so it must not change. */
  id: string;
  subjectId: string;
}

/** A word of a language Subject. */
export interface LanguageConcept extends ConceptBase {
  kind: 'language';
  /**
   * The word in the learner's own language, e.g. "trzy". Left out where there's nothing to
   * translate, e.g. in Polish spelling, whose Subject has no translation exercises.
   */
  local?: string;
  /** The word in the language being learned, e.g. "drei" or, for Polish spelling, "może". */
  foreign: string;
  /**
   * Optional other right answers in translation, e.g. "einhundert" for "hundert". Only `foreign` is
   * read aloud and offered in multiple choice.
   */
  alternatives?: string[];
  /** Optional extra context shown with the word in translation, e.g. "3". */
  hint?: string;
  /**
   * Optional words read aloud after the word in dictation, in the language being learned, to tell
   * apart words that sound the same, e.g. "zbiornik słonej wody" for "morze" (not "może").
   */
  spokenHint?: string;
  /**
   * Optional, shown with the result, with parts in square brackets highlighted, e.g. how a plural is
   * made: "das Buch → die B[ü]ch[er]".
   */
  explanation?: string;
  /**
   * Optional name of a set of like Concepts within the Subject, e.g. "weekday", or "number/small"
   * within the wider "number". In multiple choice, the others of its group are offered first as
   * wrong options, then those of each wider group.
   */
  group?: string;
  /**
   * Marks a plural noun, e.g. "die Bücher". Its article tells no gender, so it skips German article
   * choice.
   */
  plural?: boolean;
  /**
   * Optional plural of the local word, e.g. "książki". With `foreignPlural`, the word is also
   * practised with translation plural.
   */
  localPlural?: string;
  /**
   * Optional plural of the foreign word, e.g. "die Bücher" for "das Buch". The word is then also
   * practised with plural form.
   */
  foreignPlural?: string;
}

/** A question of a knowledge Subject, asked one way only. */
export interface KnowledgeConcept extends ConceptBase {
  kind: 'knowledge';
  /** E.g. "3² =" or "Reszta z dzielenia 29 przez 6". */
  question: string;
  /** Typed exactly, e.g. "9". */
  answer: string;
  /**
   * Optional, shown with the result instead of the answer, e.g. "3² = 9" or "29 : 6 = 4 r 5". Parts
   * in square brackets are highlighted.
   */
  explanation?: string;
  /**
   * Optional wrong answers to pick from, e.g. common mistakes like "36" for "2 · 3² =". Only a
   * question with them is practised with question choice.
   */
  choices?: string[];
}

/**
 * A sentence of a language Subject with one gap to fill in, practised only with cloze. Its id
 * starts with "cloze-".
 */
export interface ClozeConcept extends ConceptBase {
  kind: 'cloze';
  /**
   * The sentence in the language being learned, with its gap in square brackets, e.g. "das ist der
   * Rucksack [von Julian]".
   */
  cloze: string;
  /** Optional, shown with the sentence, e.g. its meaning: "to jest plecak Juliana". */
  hint?: string;
  /** Optional, shown with the result, with parts in square brackets highlighted. */
  explanation?: string;
}

/**
 * A way to practise a Concept:
 * - recognition-choice: see and hear the foreign word and pick the local one from a few options
 * - dictation: hear the foreign word and type how it's spelled
 * - translation-choice: see the local word and pick the foreign one from a few options
 * - article-choice-de: see a German noun without its article, e.g. "Buch", and pick der, die or das;
 *   or dieser, diese or dieses; or mein or meine for e.g. "meine Tasche", likewise ein and kein
 * - cloze: see a cloze sentence with a gap, e.g. "das ist der Rucksack ___", and type what's
 *   missing, "von Julian"
 * - translation: see the local word and type the foreign one
 * - plural-form: see the foreign word, e.g. "das Buch", and type its plural, "die Bücher"
 * - translation-plural: see the local plural, e.g. "książki", and type the foreign one
 * - question-choice: see a knowledge question and pick its answer from a few options
 * - question-type: see a knowledge question and type its answer
 */
export type ExerciseType =
  | 'recognition-choice'
  | 'dictation'
  | 'translation-choice'
  | 'article-choice-de'
  | 'cloze'
  | 'translation'
  | 'plural-form'
  | 'translation-plural'
  | 'question-choice'
  | 'question-type';

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
  /** The rating it's scheduled with: `earnedRating`, or Good at most right after the word's intro. */
  rating: Grade;
  /** Rating given automatically from the answer and how fast it was typed; it tells the XP. */
  earnedRating: Grade;
  /** Mistakes forgiven in an almost-correct answer rated Hard. */
  issues: AnswerIssue[];
  /** FSRS review log: the Card's memory state before this review. */
  log: ReviewLog;
  /** The Card's memory state after this review. */
  srsAfter: FsrsCard;
}

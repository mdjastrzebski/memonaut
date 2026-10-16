import type { LanguageConcept, Subject } from '@/domain/types';

/** German articles, in the order offered in article choice: masculine, feminine, neuter. */
export const GERMAN_ARTICLES = ['der', 'die', 'das'] as const;
export type GermanArticle = (typeof GERMAN_ARTICLES)[number];

/**
 * Words before a noun with a form for der, die and das nouns, as offered in article choice: der,
 * die and das themselves and dieser, diese and dieses, e.g. "dieses Buch".
 */
const THREE_FORMS: string[][] = [[...GERMAN_ARTICLES], ['dieser', 'diese', 'dieses']];

/**
 * Words before a noun with one form for der and das nouns and one for die nouns, e.g. "mein Buch"
 * and "meine Tasche": ein, kein and the possessives. "Ihr" is the polite "your".
 */
const TWO_FORMS: string[][] = [
  ['ein', 'eine'],
  ['kein', 'keine'],
  ['mein', 'meine'],
  ['dein', 'deine'],
  ['sein', 'seine'],
  ['ihr', 'ihre'],
  ['unser', 'unsere'],
  ['euer', 'eure'],
  ['Ihr', 'Ihre'],
];

/** A German noun split from the word before it, e.g. "das" and "Buch" for "das Buch". */
export interface GermanNoun {
  /** The word before the noun, the answer in article choice, e.g. "das", "eine" or "meine". */
  determiner: string;
  /** The words to pick from, in the order offered, e.g. der, die and das, or mein and meine. */
  options: string[];
  /** The articles the noun can take: one for e.g. "das" or "meine", der or das for e.g. "mein". */
  articles: GermanArticle[];
  noun: string;
}

/** Whether a Subject teaches German, from its language tag, e.g. "de-DE" or "de". */
export function isGerman(subject: Subject): boolean {
  return subject.kind === 'language' && /^de(-|$)/i.test(subject.foreignLanguage);
}

/** What a word before a noun tells, e.g. the options and article for "meine"; none if not one. */
export function getDeterminer(word: string): Omit<GermanNoun, 'noun'> | undefined {
  const three = THREE_FORMS.find((forms) => forms.includes(word));
  if (three) {
    return { determiner: word, options: three, articles: [GERMAN_ARTICLES[three.indexOf(word)]] };
  }
  const two = TWO_FORMS.find((forms) => forms.includes(word));
  if (!two) return undefined;
  return { determiner: word, options: two, articles: word === two[1] ? ['die'] : ['der', 'das'] };
}

/**
 * The noun of a word that is a German article, dieser, ein, kein or a possessive followed by one
 * capitalized word, e.g. "das Buch" or "meine Tasche", for article choice. Phrases like "das ist das Buch" have none, nor
 * do plurals marked plural, like "die Bücher", as their article tells no gender.
 */
export function getGermanNoun(
  concept: Pick<LanguageConcept, 'foreign' | 'plural'>,
): GermanNoun | undefined {
  if (concept.plural) return undefined;
  const match = /^(\p{L}+) (\p{Lu}\p{L}*)$/u.exec(concept.foreign);
  const determiner = match && getDeterminer(match[1]);
  return determiner ? { ...determiner, noun: match[2] } : undefined;
}

/** An ending that tells a German noun's article, always or usually. */
interface EndingRule {
  endings: string[];
  article: GermanArticle;
  /** Some nouns with it take another article, e.g. "der Junge" for -e. */
  usually?: boolean;
  /** Only of at least this many letters, so e.g. "das Ei" isn't taken for an -ei noun. */
  minLength?: number;
}

/** Longer endings first, so e.g. -chen wins over -en. */
const ENDING_RULES: EndingRule[] = [
  { endings: ['ung', 'heit', 'keit', 'schaft', 'ion', 'tät'], article: 'die' },
  { endings: ['chen', 'lein'], article: 'das' },
  { endings: ['ling', 'ismus'], article: 'der' },
  { endings: ['ei', 'ie', 'ik', 'ur'], article: 'die', usually: true, minLength: 4 },
  { endings: ['in'], article: 'die', usually: true, minLength: 5 },
  { endings: ['um', 'ment'], article: 'das', usually: true, minLength: 5 },
  { endings: ['ist', 'or', 'ig'], article: 'der', usually: true, minLength: 4 },
  { endings: ['e'], article: 'die', usually: true, minLength: 3 },
];

/** What an ending tells about a noun's article, and whether the noun follows it. */
export interface EndingHint {
  ending: string;
  article: GermanArticle;
  usually: boolean;
  /** False for an exception, e.g. "der Junge" for -e, usually die. */
  follows: boolean;
}

/** The rule a noun's ending follows or breaks, e.g. -ung for "Zeitung", if any. */
export function getEndingHint({
  articles,
  noun,
}: Pick<GermanNoun, 'articles' | 'noun'>): EndingHint | undefined {
  const word = noun.toLowerCase();
  const matches = ENDING_RULES.flatMap((rule) =>
    rule.endings
      .filter((ending) => word.endsWith(ending) && word.length >= (rule.minLength ?? 0))
      .map((ending) => ({ ending, rule })),
  );
  const longest = matches.sort((a, b) => b.ending.length - a.ending.length)[0];
  if (!longest) return undefined;
  const { ending, rule } = longest;
  return {
    ending,
    article: rule.article,
    usually: !!rule.usually,
    follows: articles.includes(rule.article),
  };
}

/** The noun with der, die or das a noun takes its article from, e.g. "der Ball" for "der Fußball". */
export interface CompoundHint {
  /** The noun with its last part marked if a compound, e.g. "der Fuß[ball]" or "mein Freund". */
  compound: string;
  /** The noun with der, die or das it takes after, e.g. "der Ball" or "der Freund". */
  base: string;
}

/**
 * Another noun of the Subject with der, die or das the noun takes its article from: the noun its
 * last part is, when a compound, e.g. "der Ball" for "der Fußball", the longest such noun winning;
 * or the noun itself, after another word, e.g. "der Freund" for "mein Freund".
 */
export function getCompoundHint(
  { determiner, articles, noun }: GermanNoun,
  subjectConcepts: Pick<LanguageConcept, 'foreign' | 'plural'>[],
): CompoundHint | undefined {
  const word = noun.toLowerCase();
  const withArticle = articles.length === 1 && determiner === articles[0];
  const base = subjectConcepts
    .map(getGermanNoun)
    .filter((other): other is GermanNoun => {
      if (!other || other.articles.length !== 1 || other.determiner !== other.articles[0]) {
        return false;
      }
      if (!articles.includes(other.articles[0])) return false;
      const otherWord = other.noun.toLowerCase();
      if (otherWord === word) return !withArticle;
      return (
        otherWord.length >= 3 && word.length >= otherWord.length + 2 && word.endsWith(otherWord)
      );
    })
    .sort((a, b) => b.noun.length - a.noun.length)[0];
  if (!base) return undefined;
  const split = noun.length - base.noun.length;
  return {
    compound: split
      ? `${determiner} ${noun.slice(0, split)}[${noun.slice(split)}]`
      : `${determiner} ${noun}`,
    base: `${base.determiner} ${base.noun}`,
  };
}

import type { LanguageConcept, Subject } from '@/domain/types';

/** German articles, in the order offered in article choice: masculine, feminine, neuter. */
export const GERMAN_ARTICLES = ['der', 'die', 'das'] as const;
export type GermanArticle = (typeof GERMAN_ARTICLES)[number];

/** A German noun split from its article, e.g. "das" and "Buch" for "das Buch". */
export interface GermanNoun {
  article: GermanArticle;
  noun: string;
}

/** Whether a Subject teaches German, from its language tag, e.g. "de-DE" or "de". */
export function isGerman(subject: Subject): boolean {
  return subject.kind === 'language' && /^de(-|$)/i.test(subject.foreignLanguage);
}

/**
 * The article and noun of a word that is a German article followed by one capitalized word, e.g.
 * "das Buch", for article choice. Phrases like "das ist das Buch" have none, nor do plurals marked
 * plural, like "die Bücher", as their article tells no gender.
 */
export function getGermanNoun(
  concept: Pick<LanguageConcept, 'foreign' | 'plural'>,
): GermanNoun | undefined {
  if (concept.plural) return undefined;
  const match = /^(der|die|das) (\p{Lu}\p{L}*)$/u.exec(concept.foreign);
  return match ? { article: match[1] as GermanArticle, noun: match[2] } : undefined;
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
export function getEndingHint({ article, noun }: GermanNoun): EndingHint | undefined {
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
    follows: rule.article === article,
  };
}

/** The noun a compound takes its article from, e.g. "der Ball" for "der Fußball". */
export interface CompoundHint {
  /** The compound with its last part marked, e.g. "der Fuß[ball]". */
  compound: string;
  /** The noun its last part is, e.g. "der Ball". */
  base: string;
}

/**
 * Its last part, when the noun is a compound ending in another noun of the Subject with the same
 * article, e.g. "der Ball" for "der Fußball". The longest such noun wins.
 */
export function getCompoundHint(
  { article, noun }: GermanNoun,
  subjectConcepts: Pick<LanguageConcept, 'foreign' | 'plural'>[],
): CompoundHint | undefined {
  const word = noun.toLowerCase();
  const base = subjectConcepts
    .map(getGermanNoun)
    .filter(
      (other): other is GermanNoun =>
        !!other &&
        other.article === article &&
        other.noun.length >= 3 &&
        word.length >= other.noun.length + 2 &&
        word.endsWith(other.noun.toLowerCase()),
    )
    .sort((a, b) => b.noun.length - a.noun.length)[0];
  if (!base) return undefined;
  const split = noun.length - base.noun.length;
  return {
    compound: `${article} ${noun.slice(0, split)}[${noun.slice(split)}]`,
    base: `${base.article} ${base.noun}`,
  };
}

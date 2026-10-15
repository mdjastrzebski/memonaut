import type { LanguageConcept } from '@/domain/types';

/** A noun split from its article, e.g. "das" and "Buch" for "das Buch". */
export interface ArticleNoun {
  article: string;
  noun: string;
}

/**
 * The article and noun of a word that is one of `articles` followed by a single word, e.g. "das
 * Buch", for article choice. Phrases like "das ist das Buch" and plurals like "die Bücher" have
 * none.
 */
export function getArticleNoun(
  concept: Pick<LanguageConcept, 'foreign' | 'plural'>,
  articles: string[] | undefined,
): ArticleNoun | undefined {
  if (!articles || concept.plural) return undefined;
  const match = /^(\S+) (\S+)$/.exec(concept.foreign);
  if (!match || !articles.includes(match[1])) return undefined;
  return { article: match[1], noun: match[2] };
}

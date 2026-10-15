import { describe, expect, it } from 'vitest';

import { getArticleNoun } from '@/exercises/article';

const ARTICLES = ['der', 'die', 'das'];

describe('getArticleNoun', () => {
  it('splits a noun from its article', () => {
    expect(getArticleNoun({ foreign: 'das Buch' }, ARTICLES)).toEqual({
      article: 'das',
      noun: 'Buch',
    });
    expect(getArticleNoun({ foreign: 'der Fußball' }, ARTICLES)).toEqual({
      article: 'der',
      noun: 'Fußball',
    });
  });

  it('skips words without one of the articles', () => {
    expect(getArticleNoun({ foreign: 'drei' }, ARTICLES)).toBeUndefined();
    expect(getArticleNoun({ foreign: 'ein Buch' }, ARTICLES)).toBeUndefined();
    expect(getArticleNoun({ foreign: 'das Buch' }, undefined)).toBeUndefined();
  });

  it('works for any language with articles', () => {
    expect(getArticleNoun({ foreign: 'la casa' }, ['el', 'la'])).toEqual({
      article: 'la',
      noun: 'casa',
    });
    expect(getArticleNoun({ foreign: 'los libros' }, ['el', 'la'])).toBeUndefined();
  });

  it('skips phrases and plurals', () => {
    expect(getArticleNoun({ foreign: 'das ist das Buch' }, ARTICLES)).toBeUndefined();
    expect(getArticleNoun({ foreign: 'die Bücher', plural: true }, ARTICLES)).toBeUndefined();
  });
});

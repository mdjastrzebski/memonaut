import { describe, expect, it } from 'vitest';

import { getCompoundHint, getEndingHint, getGermanNoun } from '@/exercises/german-articles';

describe('getGermanNoun', () => {
  it('splits a noun from its article', () => {
    expect(getGermanNoun({ foreign: 'das Buch' })).toEqual({ article: 'das', noun: 'Buch' });
    expect(getGermanNoun({ foreign: 'der Fußball' })).toEqual({ article: 'der', noun: 'Fußball' });
  });

  it('skips words without an article, phrases and plurals', () => {
    expect(getGermanNoun({ foreign: 'drei' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'ein Buch' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'das ist' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'das ist das Buch' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'die Bücher', plural: true })).toBeUndefined();
  });
});

describe('getEndingHint', () => {
  it('tells the article from an ending, the longest one first', () => {
    expect(getEndingHint({ article: 'die', noun: 'Zeitung' })).toEqual({
      ending: 'ung',
      article: 'die',
      usually: false,
      follows: true,
    });
    expect(getEndingHint({ article: 'das', noun: 'Mäppchen' })).toMatchObject({
      ending: 'chen',
      follows: true,
    });
    expect(getEndingHint({ article: 'die', noun: 'Lampe' })).toMatchObject({
      ending: 'e',
      usually: true,
      follows: true,
    });
  });

  it('marks an exception', () => {
    expect(getEndingHint({ article: 'der', noun: 'Junge' })).toEqual({
      ending: 'e',
      article: 'die',
      usually: true,
      follows: false,
    });
  });

  it('skips nouns without a telling ending, and too short ones', () => {
    expect(getEndingHint({ article: 'das', noun: 'Buch' })).toBeUndefined();
    expect(getEndingHint({ article: 'das', noun: 'Ei' })).toBeUndefined();
  });
});

describe('getCompoundHint', () => {
  const nouns = [{ foreign: 'der Ball' }, { foreign: 'die Tasche' }, { foreign: 'das Buch' }];

  it('finds the noun a compound ends with', () => {
    expect(getCompoundHint({ article: 'der', noun: 'Fußball' }, nouns)).toEqual({
      compound: 'der Fuß[ball]',
      base: 'der Ball',
    });
    expect(getCompoundHint({ article: 'die', noun: 'Schultasche' }, nouns)).toEqual({
      compound: 'die Schul[tasche]',
      base: 'die Tasche',
    });
  });

  it('skips the noun itself, and nouns with another article', () => {
    expect(getCompoundHint({ article: 'der', noun: 'Ball' }, nouns)).toBeUndefined();
    expect(getCompoundHint({ article: 'die', noun: 'Ballbuch' }, nouns)).toBeUndefined();
  });
});

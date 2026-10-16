import { describe, expect, it } from 'vitest';

import { getCompoundHint, getEndingHint, getGermanNoun } from '@/exercises/german-articles';

describe('getGermanNoun', () => {
  it('splits a noun from its article', () => {
    expect(getGermanNoun({ foreign: 'das Buch' })).toEqual({
      determiner: 'das',
      options: ['der', 'die', 'das'],
      articles: ['das'],
      noun: 'Buch',
    });
    expect(getGermanNoun({ foreign: 'der Fußball' })).toMatchObject({
      determiner: 'der',
      noun: 'Fußball',
    });
  });

  it('splits a noun from its possessive', () => {
    expect(getGermanNoun({ foreign: 'mein Freund' })).toEqual({
      determiner: 'mein',
      options: ['mein', 'meine'],
      articles: ['der', 'das'],
      noun: 'Freund',
    });
    expect(getGermanNoun({ foreign: 'eure Tasche' })).toEqual({
      determiner: 'eure',
      options: ['euer', 'eure'],
      articles: ['die'],
      noun: 'Tasche',
    });
    expect(getGermanNoun({ foreign: 'Ihr Buch' })).toMatchObject({ options: ['Ihr', 'Ihre'] });
    expect(getGermanNoun({ foreign: 'eine Lampe' })).toMatchObject({
      options: ['ein', 'eine'],
      articles: ['die'],
    });
    expect(getGermanNoun({ foreign: 'kein Problem' })).toMatchObject({
      options: ['kein', 'keine'],
      articles: ['der', 'das'],
    });
  });

  it('splits a noun from dieser, diese or dieses', () => {
    expect(getGermanNoun({ foreign: 'dieses Buch' })).toEqual({
      determiner: 'dieses',
      options: ['dieser', 'diese', 'dieses'],
      articles: ['das'],
      noun: 'Buch',
    });
  });

  it('skips words without an article, phrases and plurals', () => {
    expect(getGermanNoun({ foreign: 'drei' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'das ist' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'das ist das Buch' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'meine Telefonnummer ist' })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'meine Freunde', plural: true })).toBeUndefined();
    expect(getGermanNoun({ foreign: 'die Bücher', plural: true })).toBeUndefined();
  });
});

describe('getEndingHint', () => {
  it('tells the article from an ending, the longest one first', () => {
    expect(getEndingHint({ articles: ['die'], noun: 'Zeitung' })).toEqual({
      ending: 'ung',
      article: 'die',
      usually: false,
      follows: true,
    });
    expect(getEndingHint({ articles: ['das'], noun: 'Mäppchen' })).toMatchObject({
      ending: 'chen',
      follows: true,
    });
    expect(getEndingHint({ articles: ['die'], noun: 'Lampe' })).toMatchObject({
      ending: 'e',
      usually: true,
      follows: true,
    });
  });

  it('takes der or das after a possessive without -e', () => {
    expect(getEndingHint({ articles: ['der', 'das'], noun: 'Mäppchen' })).toMatchObject({
      follows: true,
    });
    expect(getEndingHint({ articles: ['der', 'das'], noun: 'Lampe' })).toMatchObject({
      follows: false,
    });
  });

  it('marks an exception', () => {
    expect(getEndingHint({ articles: ['der'], noun: 'Junge' })).toEqual({
      ending: 'e',
      article: 'die',
      usually: true,
      follows: false,
    });
  });

  it('skips nouns without a telling ending, and too short ones', () => {
    expect(getEndingHint({ articles: ['das'], noun: 'Buch' })).toBeUndefined();
    expect(getEndingHint({ articles: ['das'], noun: 'Ei' })).toBeUndefined();
  });
});

describe('getCompoundHint', () => {
  const noun = (foreign: string) => getGermanNoun({ foreign })!;
  const nouns = [{ foreign: 'der Ball' }, { foreign: 'die Tasche' }, { foreign: 'das Buch' }];

  it('finds the noun a compound ends with', () => {
    expect(getCompoundHint(noun('der Fußball'), nouns)).toEqual({
      compound: 'der Fuß[ball]',
      base: 'der Ball',
    });
    expect(getCompoundHint(noun('die Schultasche'), nouns)).toEqual({
      compound: 'die Schul[tasche]',
      base: 'die Tasche',
    });
  });

  it('skips the noun itself, and nouns with another article', () => {
    expect(getCompoundHint(noun('der Ball'), nouns)).toBeUndefined();
    expect(getCompoundHint(noun('die Ballbuch'), nouns)).toBeUndefined();
  });

  it('finds the noun with its article after another word', () => {
    expect(getCompoundHint(noun('mein Ball'), nouns)).toEqual({
      compound: 'mein Ball',
      base: 'der Ball',
    });
    expect(getCompoundHint(noun('dieser Ball'), nouns)).toEqual({
      compound: 'dieser Ball',
      base: 'der Ball',
    });
    expect(getCompoundHint(noun('meine Schultasche'), nouns)).toEqual({
      compound: 'meine Schul[tasche]',
      base: 'die Tasche',
    });
    expect(getCompoundHint(noun('meine Ball'), nouns)).toBeUndefined();
  });

  it('takes only a noun with der, die or das as the base', () => {
    expect(getCompoundHint(noun('der Fußball'), [{ foreign: 'mein Ball' }])).toBeUndefined();
    expect(getCompoundHint(noun('der Fußball'), [{ foreign: 'dieser Ball' }])).toBeUndefined();
  });
});

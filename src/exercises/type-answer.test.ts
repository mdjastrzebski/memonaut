import { describe, expect, test } from 'vitest';

import { Rating } from '@/srs/scheduler';

import { getFastLimitMs, gradeAnswer, normalizePunctuation } from './type-answer';

const SLOW = 60_000;

describe('exact answers', () => {
  test('fast answer is Easy', () => {
    expect(gradeAnswer('drei', 'drei', 1000).grade).toBe(Rating.Easy);
  });

  test('slow answer is Good', () => {
    expect(gradeAnswer('drei', 'drei', SLOW).grade).toBe(Rating.Good);
  });

  test('ignores surrounding and repeated whitespace', () => {
    expect(gradeAnswer('guten Tag', '  guten   Tag ', SLOW).grade).toBe(Rating.Good);
  });

  test.each([
    ["what's your name?", 'what’s your name?'],
    ["wie geht's dir?", 'wie geht´s dir?'],
    ["what's your name?", "what's your name"],
    ['Ist alles klar?', 'Ist alles klar ?'],
    ['Ist alles klar?', 'Ist alles klar?!'],
    ['drei', 'drei.'],
    ['noch einmal, bitte', 'noch einmal ,bitte'],
    ['¿Qué tal?', 'Qué tal'],
    ['¡Hola!', '¡ Hola'],
    ['hola', '¡hola!'],
  ])('forgives punctuation: %s ← %s', (expected, input) => {
    expect(gradeAnswer(expected, input, SLOW)).toMatchObject({ grade: Rating.Good, issues: [] });
  });

  test('keeps decimal commas', () => {
    expect(normalizePunctuation('3,5 Liter')).toBe('3,5 Liter');
    expect(normalizePunctuation('ja,bitte')).toBe('ja, bitte');
  });

  test('fast limit grows with answer length', () => {
    expect(getFastLimitMs('sieben')).toBeGreaterThan(getFastLimitMs('eins'));
    const limit = getFastLimitMs('sieben');
    expect(gradeAnswer('sieben', 'sieben', limit).grade).toBe(Rating.Easy);
    expect(gradeAnswer('sieben', 'sieben', limit + 1).grade).toBe(Rating.Good);
  });

  test('special characters get extra time', () => {
    expect(getFastLimitMs('fünf')).toBeGreaterThan(getFastLimitMs('funf'));
    expect(getFastLimitMs('größer')).toBeGreaterThan(getFastLimitMs('grösser'));
    const limit = getFastLimitMs('fünf');
    expect(gradeAnswer('fünf', 'fünf', limit).grade).toBe(Rating.Easy);
    expect(gradeAnswer('fünf', 'fünf', limit + 1).grade).toBe(Rating.Good);
  });
});

describe('almost correct answers are Hard', () => {
  test.each([
    ['drei', 'Drei', ['case']],
    ['fünf', 'funf', ['diacritics']],
    ['fünf', 'fuenf', ['diacritics']],
    ['Straße', 'Strasse', ['diacritics']],
    ['sieben', 'siben', ['typo']],
    ['sieben', 'siebem', ['typo']],
    ['acht', 'achtt', ['typo']],
    // Mistakes accumulate.
    ['fünf', 'Funf', ['case', 'diacritics']],
    ['fünf', 'FUENF', ['case', 'diacritics']],
    ['über', 'Uber', ['case', 'diacritics']],
    ['sieben', 'Siebem', ['case', 'typo']],
    ['fünf', 'funff', ['diacritics', 'typo']],
    ['fünf', 'fuemf', ['diacritics', 'typo']],
    ['fünf', 'Funff', ['case', 'diacritics', 'typo']],
    // Punctuation is forgiven on top.
    ["what's your name?", 'What’s your name', ['case']],
  ])('%s ← %s', (expected, input, issues) => {
    const result = gradeAnswer(expected, input, 0);
    expect(result.grade).toBe(Rating.Hard);
    expect(result.issues).toEqual(issues);
  });
});

describe('wrong answers are Again', () => {
  test.each([
    ['drei', 'zwei'],
    ['sieben', 'sibem'],
    ['acht', 'echtt'],
    ['fünf', 'Fumff'],
  ])('%s ← %s', (expected, input) => {
    expect(gradeAnswer(expected, input, 0).grade).toBe(Rating.Again);
  });
});

describe('strict spelling forgives only wrong capitalization', () => {
  const strict = { strict: true };

  test('exact answers are rated as usual', () => {
    expect(gradeAnswer('żółw', 'żółw', 1000, strict).grade).toBe(Rating.Easy);
    expect(gradeAnswer('żółw', 'żółw', SLOW, strict).grade).toBe(Rating.Good);
  });

  test('wrong capitalization is Hard', () => {
    expect(gradeAnswer('Bałtyk', 'bałtyk', SLOW, strict)).toMatchObject({
      grade: Rating.Hard,
      issues: ['case'],
    });
  });

  test.each([
    ['żółw', 'zolw'],
    ['góra', 'gura'],
    ['morze', 'może'],
    ['ja karzę', 'ja każę'],
  ])('%s ← %s is Again', (expected, input) => {
    expect(gradeAnswer(expected, input, SLOW, strict).grade).toBe(Rating.Again);
  });
});

test('a number must be exact, as one digit off is a wrong result', () => {
  expect(gradeAnswer('49', '48', 1000).grade).toBe(Rating.Again);
  expect(gradeAnswer('49', '4 9', 1000).grade).toBe(Rating.Again);
  expect(gradeAnswer('1000', '100', 1000).grade).toBe(Rating.Again);
  expect(gradeAnswer('49', ' 49 ', 1000).grade).toBe(Rating.Easy);
  // Words still forgive a letter off.
  expect(gradeAnswer('neun', 'nein', 1000).grade).toBe(Rating.Hard);
});

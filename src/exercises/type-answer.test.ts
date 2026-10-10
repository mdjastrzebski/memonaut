import { describe, expect, test } from 'vitest';

import { Rating } from '@/srs/scheduler';

import { getFastLimitMs, gradeAnswer } from './type-answer';

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

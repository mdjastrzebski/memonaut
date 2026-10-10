import { expect, test } from 'vitest';

import { checkAnswer } from './type-answer';

test('ignores case and surrounding whitespace', () => {
  expect(checkAnswer('drei', '  Drei ')).toBe(true);
});

test('accepts umlaut transliterations', () => {
  expect(checkAnswer('fünf', 'fuenf')).toBe(true);
  expect(checkAnswer('fünf', 'FÜNF')).toBe(true);
});

test('rejects wrong answers', () => {
  expect(checkAnswer('drei', 'zwei')).toBe(false);
  expect(checkAnswer('fünf', 'funf')).toBe(false);
});

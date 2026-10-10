import { expect, test } from 'vitest';

import { splitTrickySpellings } from './tricky-spellings';

const POLISH = ['ó', 'u', 'rz', 'ż', 'ch', 'h'];

const marked = (word: string, tricky = POLISH) =>
  splitTrickySpellings(word, tricky)
    .map(({ text, tricky }) => (tricky ? `[${text}]` : text))
    .join('');

test('marks every tricky spelling in a word', () => {
  expect(marked('bohater')).toBe('bo[h]ater');
  expect(marked('burza')).toBe('b[urz]a');
  expect(marked('ogórek')).toBe('og[ó]rek');
});

test('prefers longer spellings, so "ch" is not read as a tricky "h"', () => {
  expect(marked('chmura')).toBe('[ch]m[u]ra');
  expect(marked('huśtawka')).toBe('[hu]śtawka');
});

test('joins tricky spellings next to each other', () => {
  expect(splitTrickySpellings('żółw', POLISH)).toEqual([
    { text: 'żó', tricky: true },
    { text: 'łw', tricky: false },
  ]);
});

test('ignores case and keeps the word as written', () => {
  expect(marked('Hel')).toBe('[H]el');
  expect(marked('Boże Narodzenie')).toBe('Bo[ż]e Narodzenie');
});

test('leaves a word whole without tricky spellings', () => {
  expect(splitTrickySpellings('kot', POLISH)).toEqual([{ text: 'kot', tricky: false }]);
  expect(splitTrickySpellings('bohater', [])).toEqual([{ text: 'bohater', tricky: false }]);
});

import { expect, test } from 'vitest';

import { splitMarked } from './split-marked';

test('splits text at its parts in square brackets', () => {
  expect(splitMarked('das Buch → die B[ü]ch[er]')).toEqual([
    { text: 'das Buch → die B', marked: false },
    { text: 'ü', marked: true },
    { text: 'ch', marked: false },
    { text: 'er', marked: true },
  ]);
  expect(splitMarked('29 : 6 = 4 r 5')).toEqual([{ text: '29 : 6 = 4 r 5', marked: false }]);
});

import { describe, expect, test } from 'vitest';

import { diffAnswer, type DiffPart } from './answer-diff';

/** Compact notation: "=d" match, "~D/d" minor, "!z/d" wrong, "+t" extra, "-n" missing. */
function notation(parts: DiffPart[] | undefined) {
  return parts?.map(({ kind, typed, expected }) => {
    switch (kind) {
      case 'match':
        return `=${typed}`;
      case 'minor':
        return `~${typed}/${expected}`;
      case 'wrong':
        return `!${typed}/${expected}`;
      case 'extra':
        return `+${typed}`;
      case 'missing':
        return `-${expected}`;
    }
  });
}

describe('small differences are diffed letter by letter', () => {
  test.each([
    ['drei', 'drei', ['=d', '=r', '=e', '=i']],
    ['drei', 'Drei', ['~D/d', '=r', '=e', '=i']],
    ['fünf', 'funf', ['=f', '~u/ü', '=n', '=f']],
    ['fünf', 'fuenf', ['=f', '~ue/ü', '=n', '=f']],
    ['Straße', 'Strasse', ['=S', '=t', '=r', '=a', '~ss/ß', '=e']],
    ['sieben', 'siebem', ['=s', '=i', '=e', '=b', '=e', '!m/n']],
    ['sieben', 'siben', ['=s', '=i', '-e', '=b', '=e', '=n']],
    ['acht', 'achtt', ['=a', '=c', '=h', '=t', '+t']],
    ['sieben', 'sibem', ['=s', '=i', '-e', '=b', '=e', '!m/n']],
    ['fünf', 'FUENF', ['~F/f', '~UE/ü', '~N/n', '~F/f']],
    ['guten Tag', ' guten  tag ', ['=g', '=u', '=t', '=e', '=n', '= ', '~t/T', '=a', '=g']],
  ])('%s ← %s', (expected, input, parts) => {
    expect(notation(diffAnswer(expected, input))).toEqual(parts);
  });
});

describe('large differences are not diffed', () => {
  test.each([
    ['drei', 'zwei'],
    ['acht', 'echtt'],
    ['sieben', 'falsch'],
    ['sieben', 'sbn'],
  ])('%s ← %s', (expected, input) => {
    expect(diffAnswer(expected, input)).toBeUndefined();
  });
});

import { describe, expect, it } from 'vitest';

import { fillCloze, splitCloze } from '@/exercises/cloze';

describe('splitCloze', () => {
  it('splits a sentence at its gap', () => {
    expect(splitCloze('das ist [der] Rucksack von Julian')).toEqual({
      before: 'das ist ',
      gap: 'der',
      after: ' Rucksack von Julian',
    });
  });

  it('allows a gap at the start or end', () => {
    expect(splitCloze('[das] Handy')).toEqual({ before: '', gap: 'das', after: ' Handy' });
    expect(splitCloze('von [Anna]')).toEqual({ before: 'von ', gap: 'Anna', after: '' });
  });

  it('needs exactly one gap with something in it', () => {
    expect(splitCloze('das ist der Rucksack')).toBeUndefined();
    expect(splitCloze('[das] ist [der] Rucksack')).toBeUndefined();
    expect(splitCloze('das ist [ ] Rucksack')).toBeUndefined();
  });
});

describe('fillCloze', () => {
  it('fills in the gap', () => {
    expect(fillCloze(splitCloze('das ist [das] Handy von Anna')!)).toBe(
      'das ist das Handy von Anna',
    );
  });
});

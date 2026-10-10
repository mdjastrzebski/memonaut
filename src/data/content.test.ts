import { expect, test } from 'vitest';

import { buildContent, content } from './content';

const subject = 'id: german\nname: German\nforeignLanguage: de-DE\n';

test('loads the bundled content', () => {
  expect(content.subjects.map((subject) => subject.id)).toContain('german');
  const kapitel0 = content.decks.find((deck) => deck.id === 'german/kapitel-0');
  const core = content.decks.find((deck) => deck.id === 'german/core');
  expect(kapitel0?.conceptIds).not.toContain('german/number-10');
  expect(core?.conceptIds).toContain('german/number-0');
  expect(core?.conceptIds).toContain('german/number-10');
});

test('keeps every value a string', () => {
  const { concepts } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/numbers.yaml': `
id: numbers
name: Numbers
concepts:
  - { id: number-0, local: zero, foreign: null, hint: 0 }
`,
  });
  expect(concepts).toEqual([
    { id: 'german/number-0', subjectId: 'german', local: 'zero', foreign: 'null', hint: '0' },
  ]);
});

test('the core deck has every concept marked core in any unit, once', () => {
  const { decks, concepts } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/animals.yaml': `
id: animals
name: Animals
concepts:
  - { id: der-hund, local: pies, foreign: der Hund, core: true }
  - { id: die-katze, local: kot, foreign: die Katze }
`,
    './german/decks/pets.yaml': `
id: pets
name: Pets
concepts:
  - { id: die-katze, local: kot, foreign: die Katze, core: true }
  - { id: der-hund, local: pies, foreign: der Hund, core: true }
`,
  });
  expect(decks.find((deck) => deck.kind === 'core')).toEqual({
    id: 'german/core',
    subjectId: 'german',
    kind: 'core',
    name: 'Essentials',
    conceptIds: ['german/der-hund', 'german/die-katze'],
  });
  expect(decks.find((deck) => deck.id === 'german/pets')?.conceptIds).toEqual([
    'german/die-katze',
    'german/der-hund',
  ]);
  expect(concepts.map((concept) => concept.id)).toEqual(['german/der-hund', 'german/die-katze']);
});

test('the core deck starts with core.yaml, which is not a unit', () => {
  const { decks, concepts } = buildContent({
    './german/subject.yaml': subject,
    './german/core.yaml': `
concepts:
  - { id: ja, local: tak, foreign: ja }
  - { id: der-hund, local: pies, foreign: der Hund }
`,
    './german/decks/animals.yaml': `
id: animals
name: Animals
concepts:
  - { id: die-katze, local: kot, foreign: die Katze, core: true }
  - { id: der-hund, local: pies, foreign: der Hund }
`,
  });
  expect(decks.map((deck) => [deck.id, deck.kind])).toEqual([
    ['german/animals', 'unit'],
    ['german/core', 'core'],
  ]);
  expect(decks.find((deck) => deck.kind === 'core')?.conceptIds).toEqual([
    'german/ja',
    'german/der-hund',
    'german/die-katze',
  ]);
  expect(concepts.map((concept) => concept.id)).toEqual([
    'german/ja',
    'german/der-hund',
    'german/die-katze',
  ]);
});

test('has no core deck when no concept is marked core', () => {
  const { decks } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/animals.yaml': `
id: animals
name: Animals
concepts:
  - { id: der-hund, local: pies, foreign: der Hund, core: false }
`,
  });
  expect(decks.map((deck) => deck.kind)).toEqual(['unit']);
});

test('the bundled Polish words are practised with dictation only, with hints for homophones', () => {
  const polish = content.subjects.find((subject) => subject.id === 'polish');
  expect(polish?.exerciseTypes).toEqual(['dictation']);
  const concept = (id: string) => content.concepts.find((concept) => concept.id === id);
  expect(concept('polish/morze')).toMatchObject({
    foreign: 'morze',
    spokenHint: 'zbiornik słonej wody',
  });
  expect(concept('polish/moze')).toMatchObject({ foreign: 'może', spokenHint: 'przypuszczenie' });
  // The popular words are all among the 400, so practising them counts in both.
  const deck = (id: string) => content.decks.find((deck) => deck.id === id)!;
  const all = deck('polish/400-trudnych-slow').conceptIds;
  expect(
    deck('polish/100-popularnych-trudnych-slow').conceptIds.filter((id) => !all.includes(id)),
  ).toEqual([]);
});

test('a deck can rate spelling strictly, and core.yaml sets it for the core deck', () => {
  const { decks } = buildContent({
    './german/subject.yaml': subject,
    './german/core.yaml': 'strictSpelling: true\nconcepts:\n  - { id: a, local: x, foreign: y }\n',
    './german/decks/strict.yaml': `
id: strict
name: Strict
strictSpelling: true
concepts:
  - { id: b, local: x, foreign: z }
`,
    './german/decks/relaxed.yaml': `
id: relaxed
name: Relaxed
concepts:
  - { id: c, local: x, foreign: w }
`,
  });
  const strictSpelling = (id: string) => decks.find((deck) => deck.id === id)?.strictSpelling;
  expect(strictSpelling('german/core')).toBe(true);
  expect(strictSpelling('german/strict')).toBe(true);
  expect(strictSpelling('german/relaxed')).toBeUndefined();
  expect(
    content.decks.filter((deck) => deck.subjectId === 'polish').map((deck) => deck.strictSpelling),
  ).toEqual([true, true]);
});

test('a subject practises every exercise type unless it lists some, easiest first', () => {
  const exerciseTypes = (listed: string) =>
    buildContent({ './german/subject.yaml': subject + listed }).subjects[0].exerciseTypes;
  expect(exerciseTypes('')).toEqual(['dictation', 'translation']);
  expect(exerciseTypes('exerciseTypes: [translation, dictation]\n')).toEqual([
    'dictation',
    'translation',
  ]);
  expect(exerciseTypes('exerciseTypes: [dictation]\n')).toEqual(['dictation']);
  expect(() => exerciseTypes('exerciseTypes: []\n')).toThrow(/subject\.yaml/);
  expect(() => exerciseTypes('exerciseTypes: [flashcard]\n')).toThrow(/subject\.yaml/);
});

test('words of a subject without translation need no local word, and keep a spoken hint', () => {
  const { concepts } = buildContent({
    './polish/subject.yaml':
      'id: polish\nname: Polish\nforeignLanguage: pl-PL\nexerciseTypes: [dictation]\n',
    './polish/decks/a.yaml': `
id: a
name: A
concepts:
  - { id: morze, foreign: morze, spokenHint: zbiornik słonej wody }
`,
  });
  expect(concepts).toEqual([
    {
      id: 'polish/morze',
      subjectId: 'polish',
      foreign: 'morze',
      spokenHint: 'zbiornik słonej wody',
    },
  ]);
});

test('rejects invalid content', () => {
  const deck = (concepts: string, id = 'd') => `id: ${id}\nname: D\nconcepts:\n${concepts}`;
  const build = (decks: Record<string, string>) =>
    buildContent({ './german/subject.yaml': subject, ...decks });

  expect(() => build({ './german/decks/a.yaml': deck('  - { id: a, local: x }\n') })).toThrow(
    /a\.yaml/,
  );
  expect(() => build({ './german/decks/a.yaml': deck('  - { id: a, foreign: y }\n') })).toThrow(
    'a.yaml: concept "a" needs a local word for translation',
  );
  expect(() =>
    build({
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y, spokenHint: p }\n'),
      './german/decks/b.yaml': deck('  - { id: a, local: x, foreign: y, spokenHint: q }\n', 'e'),
    }),
  ).toThrow('b.yaml: concept "a" is defined differently in another deck');
  expect(() =>
    build({
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y }\n'),
      './german/decks/b.yaml': deck('  - { id: a, local: x, foreign: z }\n', 'e'),
    }),
  ).toThrow('b.yaml: concept "a" is defined differently in another deck');
  expect(() =>
    build({
      './german/decks/a.yaml': deck(
        '  - { id: a, local: x, foreign: y }\n  - { id: a, local: x, foreign: y }\n',
      ),
    }),
  ).toThrow('concept listed twice "a"');
  expect(() =>
    build({ './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y }\n', 'core') }),
  ).toThrow('duplicate deck id "core"');
  expect(() =>
    build({ './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y, core: yes }\n') }),
  ).toThrow(/a\.yaml/);
  expect(() =>
    build({
      './german/core.yaml': 'concepts:\n  - { id: a, local: x, foreign: y }\n',
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: z }\n'),
    }),
  ).toThrow('a.yaml: concept "a" is defined differently in another deck');
  expect(() =>
    build({ './german/core.yaml': 'concepts:\n  - { id: a, local: x, foreign: y, core: true }\n' }),
  ).toThrow(/core\.yaml/);
  expect(() => buildContent({ './german/decks/a.yaml': deck('') })).toThrow(
    'subject.yaml: missing',
  );
});

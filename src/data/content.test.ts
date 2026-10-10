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

test('rejects invalid content', () => {
  const deck = (concepts: string, id = 'd') => `id: ${id}\nname: D\nconcepts:\n${concepts}`;
  const build = (decks: Record<string, string>) =>
    buildContent({ './german/subject.yaml': subject, ...decks });

  expect(() => build({ './german/decks/a.yaml': deck('  - { id: a, local: x }\n') })).toThrow(
    /a\.yaml/,
  );
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

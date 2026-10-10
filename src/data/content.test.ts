import { expect, test } from 'vitest';

import { buildContent, content } from './content';

const subject = 'id: german\nname: German\n';

test('loads the bundled content', () => {
  expect(content.subjects.map((subject) => subject.id)).toContain('german');
  const numbers = content.decks.find((deck) => deck.id === 'german/numbers-0-10');
  expect(numbers?.conceptIds).toHaveLength(11);
});

test('keeps every value a string', () => {
  const { concepts } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/numbers.yaml': `
id: numbers
kind: unit
name: Numbers
concepts:
  - { id: number-0, local: zero, foreign: null, hint: 0 }
`,
  });
  expect(concepts).toEqual([
    { id: 'german/number-0', subjectId: 'german', local: 'zero', foreign: 'null', hint: '0' },
  ]);
});

test('a core deck includes concepts from unit decks', () => {
  const { decks } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/animals.yaml': `
id: animals
kind: unit
name: Animals
concepts:
  - { id: der-hund, local: pies, foreign: der Hund }
  - { id: die-katze, local: kot, foreign: die Katze }
`,
    './german/decks/core.yaml': `
id: core
kind: core
name: Essentials
include: [der-hund]
concepts:
  - { id: ja, local: tak, foreign: ja }
`,
  });
  expect(decks.find((deck) => deck.kind === 'core')?.conceptIds).toEqual([
    'german/ja',
    'german/der-hund',
  ]);
});

test('rejects invalid content', () => {
  const deck = (concepts: string, extra = '') =>
    `id: d\nkind: unit\nname: D\n${extra}concepts:\n${concepts}`;
  const build = (decks: Record<string, string>) =>
    buildContent({ './german/subject.yaml': subject, ...decks });

  expect(() => build({ './german/decks/a.yaml': deck('  - { id: a, local: x }\n') })).toThrow(
    /a\.yaml/,
  );
  expect(() =>
    build({
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y }\n'),
      './german/decks/b.yaml': deck('  - { id: a, local: x, foreign: y }\n').replace(
        'id: d',
        'id: e',
      ),
    }),
  ).toThrow('duplicate concept id "a"');
  expect(() =>
    build({
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y }\n', 'include: [b]\n'),
    }),
  ).toThrow('included concept "b" is not defined');
  expect(() => buildContent({ './german/decks/a.yaml': deck('') })).toThrow(
    'subject.yaml: missing',
  );
});

import { expect, test } from 'vitest';

import { getConceptExerciseTypes } from '@/session/session';

import { buildContent, content } from './content';

const subject = 'id: german\nname: German\nkind: language\nforeignLanguage: de-DE\n';

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
    {
      id: 'german/number-0',
      subjectId: 'german',
      kind: 'language',
      local: 'zero',
      foreign: 'null',
      hint: '0',
    },
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
    exerciseTypes: ['recognition-choice', 'dictation', 'translation-choice', 'translation'],
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

test('the bundled words are grouped', () => {
  const group = (id: string) => {
    const concept = content.concepts.find((concept) => concept.id === id);
    return concept?.kind === 'language' ? concept.group : undefined;
  };
  expect(group('english/monday')).toBe('weekday');
  expect(group('german/number-3')).toBe('number/small');
});

test('the bundled Polish words are practised with dictation only, with hints for homophones', () => {
  const polish = content.subjects.find((subject) => subject.id === 'polish');
  expect(polish?.exerciseTypes).toEqual(['dictation']);
  expect(polish?.trickySpellings).toEqual(['ó', 'u', 'rz', 'ż', 'ch', 'h']);
  const concept = (id: string) => content.concepts.find((concept) => concept.id === id);
  expect(concept('polish/morze')).toMatchObject({
    foreign: 'morze',
    spokenHint: 'zbiornik słonej wody',
  });
  expect(concept('polish/moze')).toMatchObject({ foreign: 'może', spokenHint: 'przypuszczenie' });
  expect(
    content.decks.filter((deck) => deck.subjectId === 'polish').map((deck) => deck.name),
  ).toEqual(['Trudne słówka']);
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
  ).toEqual([true]);
});

test('a deck can shuffle new concepts, and core.yaml sets it for the core deck', () => {
  const { decks } = buildContent({
    './german/subject.yaml': subject,
    './german/core.yaml': 'shuffleNew: true\nconcepts:\n  - { id: a, local: x, foreign: y }\n',
    './german/decks/shuffled.yaml': `
id: shuffled
name: Shuffled
shuffleNew: true
concepts:
  - { id: b, local: x, foreign: z }
`,
    './german/decks/ordered.yaml': `
id: ordered
name: Ordered
concepts:
  - { id: c, local: x, foreign: w }
`,
  });
  const shuffleNew = (id: string) => decks.find((deck) => deck.id === id)?.shuffleNew;
  expect(shuffleNew('german/core')).toBe(true);
  expect(shuffleNew('german/shuffled')).toBe(true);
  expect(shuffleNew('german/ordered')).toBeUndefined();
  expect(
    content.decks.filter((deck) => deck.subjectId === 'polish').map((deck) => deck.shuffleNew),
  ).toEqual([true]);
});

test('a subject practises every exercise type unless it lists some, easiest first', () => {
  const exerciseTypes = (listed: string) =>
    buildContent({ './german/subject.yaml': subject + listed }).subjects[0].exerciseTypes;
  expect(exerciseTypes('')).toEqual([
    'recognition-choice',
    'dictation',
    'translation-choice',
    'translation',
  ]);
  expect(exerciseTypes('exerciseTypes: [translation, dictation]\n')).toEqual([
    'dictation',
    'translation',
  ]);
  expect(exerciseTypes('exerciseTypes: [dictation]\n')).toEqual(['dictation']);
  expect(() => exerciseTypes('exerciseTypes: []\n')).toThrow(/subject\.yaml/);
  expect(() => exerciseTypes('exerciseTypes: [flashcard]\n')).toThrow(/subject\.yaml/);
});

test('a deck can practise fewer exercise types than its subject, and core.yaml sets them for the core deck', () => {
  const { decks } = buildContent({
    './german/subject.yaml': subject,
    './german/core.yaml':
      'exerciseTypes: [translation, dictation]\nconcepts:\n  - { id: a, local: x, foreign: y }\n',
    './german/decks/typed.yaml': `
id: typed
name: Typed
exerciseTypes: [dictation]
concepts:
  - { id: b, local: x, foreign: z }
`,
    './german/decks/all.yaml': `
id: all
name: All
concepts:
  - { id: c, local: x, foreign: w }
`,
  });
  const exerciseTypes = (id: string) => decks.find((deck) => deck.id === id)?.exerciseTypes;
  expect(exerciseTypes('german/core')).toEqual(['dictation', 'translation']);
  expect(exerciseTypes('german/typed')).toEqual(['dictation']);
  expect(exerciseTypes('german/all')).toEqual([
    'recognition-choice',
    'dictation',
    'translation-choice',
    'translation',
  ]);

  expect(() =>
    buildContent({
      './polish/subject.yaml':
        'id: polish\nname: Polish\nkind: language\nforeignLanguage: pl-PL\nexerciseTypes: [dictation]\n',
      './polish/decks/a.yaml':
        'id: a\nname: A\nexerciseTypes: [recognition-choice]\nconcepts:\n  - { id: b, foreign: z }\n',
    }),
  ).toThrow(/a\.yaml: exercise type "recognition-choice" is not one of the subject's/);
});

test('the bundled English and German units practise multiple choice, but not their core sets', () => {
  const exerciseTypes = (subjectId: string, kind: string) => [
    ...new Set(
      content.decks
        .filter((deck) => deck.subjectId === subjectId && deck.kind === kind)
        .map((deck) => deck.exerciseTypes.join()),
    ),
  ];
  expect(exerciseTypes('english', 'unit')).toEqual([
    'recognition-choice,dictation,translation-choice,translation',
  ]);
  expect(exerciseTypes('german', 'unit')).toEqual([
    'recognition-choice,dictation,translation-choice,article-choice,translation',
  ]);
  for (const subjectId of ['english', 'german']) {
    expect(exerciseTypes(subjectId, 'core')).toEqual(['dictation,translation']);
  }
  expect(exerciseTypes('polish', 'unit')).toEqual(['dictation']);
});

test('words of a subject without translation need no local word, and keep a spoken hint', () => {
  const { concepts } = buildContent({
    './polish/subject.yaml':
      'id: polish\nname: Polish\nkind: language\nforeignLanguage: pl-PL\nexerciseTypes: [dictation]\n',
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
      kind: 'language',
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
    'a.yaml: concept "a" needs a local word for recognition-choice',
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
      './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y, group: weekday }\n'),
      './german/decks/b.yaml': deck('  - { id: a, local: x, foreign: y }\n', 'e'),
    }),
  ).toThrow('b.yaml: concept "a" is defined differently in another deck');
  expect(() =>
    build({ './german/decks/a.yaml': deck('  - { id: a, local: x, foreign: y, group: day/ }\n') }),
  ).toThrow(/a\.yaml/);
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

test('a subject with articles practises its singular nouns with article choice', () => {
  const { subjects, decks } = buildContent({
    './german/subject.yaml': `${subject}articles: [der, die, das]\n`,
    './german/decks/a.yaml': `
id: a
name: A
concepts:
  - { id: das-buch, local: książka, foreign: das Buch }
  - { id: die-buecher, local: książki, foreign: die Bücher, plural: true }
  - { id: das-ist-das-buch, local: to jest książka, foreign: das ist das Buch }
  - { id: drei, local: trzy, foreign: drei }
`,
  });
  const exerciseTypes = [
    'recognition-choice',
    'dictation',
    'translation-choice',
    'article-choice',
    'translation',
  ];
  expect(subjects[0]).toMatchObject({ articles: ['der', 'die', 'das'], exerciseTypes });
  const withoutArticle = exerciseTypes.filter((type) => type !== 'article-choice');
  expect(decks[0].conceptExerciseTypes).toEqual({
    'german/die-buecher': withoutArticle,
    'german/das-ist-das-buch': withoutArticle,
    'german/drei': withoutArticle,
  });
});

test('article choice works for any language with articles, offered in their order', () => {
  const { subjects, decks } = buildContent({
    './spanish/subject.yaml':
      'id: spanish\nname: Spanish\nkind: language\nforeignLanguage: es-ES\narticles: [el, la]\n',
    './spanish/decks/a.yaml': `
id: a
name: A
concepts:
  - { id: el-libro, local: książka, foreign: el libro }
  - { id: los-libros, local: książki, foreign: los libros }
`,
  });
  expect(subjects[0]).toMatchObject({ articles: ['el', 'la'] });
  expect(subjects[0].exerciseTypes).toContain('article-choice');
  expect(decks[0].conceptExerciseTypes?.['spanish/el-libro']).toBeUndefined();
  expect(decks[0].conceptExerciseTypes?.['spanish/los-libros']).not.toContain('article-choice');
  expect(() =>
    buildContent({
      './spanish/subject.yaml':
        'id: spanish\nname: Spanish\nkind: language\nforeignLanguage: es-ES\narticles: [el, el]\n',
    }),
  ).toThrow(/Use each article once/);
});

test('a subject without articles has no article choice', () => {
  const deck =
    'id: a\nname: A\nconcepts:\n  - { id: das-buch, local: książka, foreign: das Buch }\n';
  const { subjects } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/a.yaml': deck,
  });
  expect(subjects[0].exerciseTypes).not.toContain('article-choice');
  expect(() =>
    buildContent({
      './german/subject.yaml': `${subject}exerciseTypes: [article-choice, translation]\n`,
      './german/decks/a.yaml': deck,
    }),
  ).toThrow(/subject\.yaml: exercise type "article-choice" needs articles/);
});

test('a knowledge subject asks questions, practised with choice only when they have choices', () => {
  const { subjects, concepts, decks } = buildContent({
    './math/subject.yaml': 'id: math\nname: Math\nkind: knowledge\n',
    './math/decks/powers.yaml': `
id: powers
name: Powers
concepts:
  - { id: square-3, question: '3² =', answer: '9', explanation: '3² = 9' }
  - { id: twice-square-3, question: '2 · 3² =', answer: '18', choices: [36, 12] }
`,
  });
  const exerciseTypes = ['question-choice', 'question-type'];
  expect(subjects[0]).toMatchObject({ kind: 'knowledge', exerciseTypes });
  expect(decks[0].exerciseTypes).toEqual(exerciseTypes);
  expect(decks[0].conceptExerciseTypes).toEqual({ 'math/square-3': ['question-type'] });
  expect(getConceptExerciseTypes(decks[0], 'math/twice-square-3')).toEqual(exerciseTypes);
  expect(concepts).toEqual([
    {
      id: 'math/square-3',
      subjectId: 'math',
      kind: 'knowledge',
      question: '3² =',
      answer: '9',
      explanation: '3² = 9',
    },
    {
      id: 'math/twice-square-3',
      subjectId: 'math',
      kind: 'knowledge',
      question: '2 · 3² =',
      answer: '18',
      choices: ['36', '12'],
    },
  ]);
});

test('question choices leave out the answer, and a deck has an exercise type for each question', () => {
  const math = (deck: string) => () =>
    buildContent({
      './math/subject.yaml': 'id: math\nname: Math\nkind: knowledge\n',
      './math/decks/a.yaml': `id: a\nname: A\n${deck}`,
    });
  expect(
    math("concepts:\n  - { id: a, question: '1 + 1', answer: '2', choices: [3, 2] }\n"),
  ).toThrow(/a\.yaml: concept "a" has its answer among its wrong choices/);
  expect(
    math(
      "exerciseTypes: [question-choice]\nconcepts:\n  - { id: a, question: '1 + 1', answer: '2' }\n",
    ),
  ).toThrow(/a\.yaml: concept "a" fits none of the deck's exercise types/);
});

test('a subject needs a kind, and fields and exercise types of that kind', () => {
  const math =
    (subject: string, concept = "{ id: a, question: '1 + 1', answer: '2' }") =>
    () =>
      buildContent({
        './math/subject.yaml': `id: math\nname: Math\n${subject}`,
        './math/decks/a.yaml': `id: a\nname: A\nconcepts:\n  - ${concept}\n`,
      });
  expect(math('')).toThrow(/subject\.yaml/);
  expect(math('kind: knowledge\nforeignLanguage: pl-PL\n')).toThrow(/foreignLanguage/);
  expect(math('kind: knowledge\nexerciseTypes: [translation]\n')).toThrow(
    /Use exercise types of a knowledge subject: question-choice, question-type/,
  );
  expect(math('kind: language\nforeignLanguage: pl-PL\nexerciseTypes: [question-type]\n')).toThrow(
    /Use exercise types of a language subject/,
  );
  expect(math('kind: knowledge\n', '{ id: a, local: jeden, foreign: one }')).toThrow(/a\.yaml/);
});

test('a word can have alternative answers', () => {
  const { concepts } = buildContent({
    './german/subject.yaml': subject,
    './german/decks/numbers.yaml': `
id: numbers
name: Numbers
concepts:
  - { id: number-100, local: sto, foreign: hundert, alternatives: [einhundert] }
`,
  });
  expect(concepts[0]).toMatchObject({ foreign: 'hundert', alternatives: ['einhundert'] });
});

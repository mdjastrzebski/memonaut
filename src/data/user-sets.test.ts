import { expect, test } from 'vitest';

import {
  addSubject,
  importDeck,
  loadContent,
  readDeckHeader,
  removeDeck,
  removeSubject,
} from '@/data/user-sets';
import type { LanguageConcept } from '@/domain/types';
import { createBackup } from '@/progress/backup';
import { getProgressKey } from '@/progress/progress-storage';
import { testFiles as files } from '@/test/content';

const FOOD = `
id: food
name: Food
concepts:
  # Bread first.
  - { id: bread, local: chleb, foreign: bread, core: true }
  - { id: milk, local: mleko, foreign: milk }
`;

const getConcept = (id: string) =>
  loadContent(files).content.concepts.find((concept) => concept.id === id) as LanguageConcept;

test('an imported set is a unit of its subject, stored as JSON apart from progress', () => {
  const result = importDeck(files, 'english', FOOD, new Date('2026-10-23T10:00:00Z'));

  expect(result).toMatchObject({ ok: true, value: { id: 'english/food', name: 'Food' } });
  const { content, broken } = loadContent(files);
  expect(broken).toEqual([]);
  expect(content.decks.find((deck) => deck.id === 'english/food')).toMatchObject({
    kind: 'unit',
    custom: true,
    conceptIds: ['english/bread', 'english/milk'],
  });
  expect(JSON.parse(localStorage.getItem('memonaut:set:english:food')!)).toEqual({
    version: 1,
    addedAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-23T10:00:00.000Z',
    deck: {
      id: 'food',
      name: 'Food',
      concepts: [
        { id: 'bread', local: 'chleb', foreign: 'bread', core: 'true' },
        { id: 'milk', local: 'mleko', foreign: 'milk' },
      ],
    },
  });
  expect(localStorage.getItem(getProgressKey('english'))).toBeNull();
});

test("an imported set's core concepts join the subject's core deck", () => {
  importDeck(files, 'english', FOOD);

  const core = loadContent(files).content.decks.find((deck) => deck.id === 'english/core')!;
  expect(core.conceptIds).toEqual(['english/red', 'english/blue', 'english/bread']);
});

test("an imported set's definition of a concept is used everywhere in its subject", () => {
  importDeck(
    files,
    'english',
    `
id: week
name: Week
concepts:
  - { id: monday, local: poniedziałek (pn.), foreign: Monday }
`,
  );

  expect(getConcept('english/monday').local).toBe('poniedziałek (pn.)');
  const unit = loadContent(files).content.decks.find(
    (deck) => deck.id === 'english/days-months-seasons',
  );
  expect(unit?.conceptIds).toContain('english/monday');
});

test('a new version of a set replaces it in its place, keeping progress', () => {
  importDeck(files, 'english', FOOD, new Date('2026-10-23T10:00:00Z'));
  importDeck(
    files,
    'english',
    'id: drinks\nname: Drinks\nconcepts: [{ id: tea, local: herbata, foreign: tea }]',
  );
  localStorage.setItem(getProgressKey('english'), '{"version":1,"words":{"bread":{}}}');

  const result = importDeck(
    files,
    'english',
    `${FOOD}  - { id: butter, local: masło, foreign: butter }\n`,
    new Date('2026-10-24T10:00:00Z'),
  );

  expect(result.ok).toBe(true);
  const custom = loadContent(files).content.decks.filter((deck) => deck.custom);
  expect(custom.map((deck) => deck.id)).toEqual(['english/food', 'english/drinks']);
  expect(custom[0].conceptIds).toContain('english/butter');
  expect(JSON.parse(localStorage.getItem('memonaut:set:english:food')!)).toMatchObject({
    addedAt: '2026-10-23T10:00:00.000Z',
    updatedAt: '2026-10-24T10:00:00.000Z',
  });
  expect(localStorage.getItem(getProgressKey('english'))).toBe(
    '{"version":1,"words":{"bread":{}}}',
  );
});

test('a set that does not build is not saved', () => {
  const missingLocal = importDeck(
    files,
    'english',
    'id: food\nname: Food\nconcepts: [{ id: bread, foreign: bread }]',
  );
  const bundledId = importDeck(
    files,
    'english',
    'id: days-months-seasons\nname: Days\nconcepts: [{ id: bread, local: chleb, foreign: bread }]',
  );
  const notADeck = importDeck(files, 'english', '- just a list');

  expect(missingLocal).toEqual({
    ok: false,
    error: 'my sets: english/food: concept "bread" needs a local word for recognition-choice',
  });
  expect(bundledId).toMatchObject({
    ok: false,
    error: expect.stringContaining('duplicate deck id'),
  });
  expect(notADeck.ok).toBe(false);
  expect(Object.keys(localStorage)).toEqual([]);
});

test('a stored set that no longer builds is left out and reported', () => {
  importDeck(files, 'english', FOOD);
  localStorage.setItem(
    'memonaut:set:english:broken',
    JSON.stringify({
      version: 1,
      addedAt: '',
      deck: { id: 'broken', name: 'Broken', concepts: 'x' },
    }),
  );
  localStorage.setItem('memonaut:set:english:future', JSON.stringify({ version: 2, deck: {} }));

  const { content, broken } = loadContent(files);

  expect(content.decks.some((deck) => deck.id === 'english/food')).toBe(true);
  expect(broken.map((set) => [set.key, set.name])).toEqual([
    ['memonaut:set:english:future', 'memonaut:set:english:future'],
    ['memonaut:set:english:broken', 'Broken'],
  ]);
});

test("a subject of the user's is read aloud in its language and holds imported sets", () => {
  const added = addSubject(files, {
    name: 'Français',
    emoji: '🇫🇷',
    kind: 'language',
    foreignLanguage: 'fr-FR',
    specialCharacters: ['é', 'ç'],
  });
  expect(added).toMatchObject({
    ok: true,
    value: { id: 'francais', name: 'Français', foreignLanguage: 'fr-FR', custom: true },
  });

  importDeck(
    files,
    'francais',
    'id: food\nname: Food\nconcepts: [{ id: bread, local: chleb, foreign: le pain }]',
  );

  const { content } = loadContent(files);
  expect(content.decks.find((deck) => deck.id === 'francais/food')?.custom).toBe(true);
  expect(getConcept('francais/bread').foreign).toBe('le pain');
  expect(addSubject(files, { name: 'français', kind: 'knowledge' })).toEqual({
    ok: false,
    error: "There's already a subject named français.",
  });
});

test("a subject's id is made from its name and never clashes", () => {
  expect(addSubject(files, { name: 'Matematyka', kind: 'knowledge' }).ok).toBe(false);
  const added = addSubject(files, { name: 'Math!', kind: 'knowledge' });
  expect(added).toMatchObject({ ok: true, value: { id: 'math-2', kind: 'knowledge' } });
});

test('removing a subject removes its sets; removing a set keeps the others', () => {
  addSubject(files, { name: 'French', kind: 'language', foreignLanguage: 'fr-FR' });
  importDeck(files, 'french', FOOD);
  importDeck(files, 'english', FOOD);

  expect(removeDeck('english', 'food')).toBe(true);
  expect(loadContent(files).content.decks.some((deck) => deck.id === 'french/food')).toBe(true);
  expect(removeSubject('french')).toBe(true);

  expect(Object.keys(localStorage)).toEqual([]);
  expect(loadContent(files).content.subjects.map((subject) => subject.id)).toEqual([
    'english',
    'german',
    'math',
    'polish',
  ]);
});

test('reads the id and name of a set before importing it', () => {
  expect(readDeckHeader(FOOD)).toEqual({ id: 'food', name: 'Food' });
  expect(readDeckHeader('[')).toBeNull();
});

test("a backup carries the user's subjects and sets", () => {
  addSubject(files, { name: 'French', kind: 'language', foreignLanguage: 'fr-FR' });
  importDeck(files, 'french', FOOD);

  expect(Object.keys(JSON.parse(createBackup()).data).sort()).toEqual([
    'memonaut:area:french',
    'memonaut:set:french:food',
  ]);
});

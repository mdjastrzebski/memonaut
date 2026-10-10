import { parse } from 'yaml';
import { z } from 'zod';

import type { Concept, Deck, Subject } from '@/domain/types';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes');

const subjectSchema = z.strictObject({
  id,
  name: z.string(),
  emoji: z.string().optional(),
  foreignLanguage: z.string(),
  specialCharacters: z.array(z.string()).optional(),
});

const conceptSchema = z.strictObject({
  id,
  local: z.string().min(1),
  foreign: z.string().min(1),
  hint: z.string().optional(),
});

const deckSchema = z.strictObject({
  id,
  kind: z.enum(['unit', 'core']),
  name: z.string(),
  /** Concepts this Deck introduces. */
  concepts: z.array(conceptSchema).default([]),
  /** Ids of Concepts introduced by other Decks of the same Subject. */
  include: z.array(id).default([]),
});

export interface Content {
  subjects: Subject[];
  decks: Deck[];
  concepts: Concept[];
}

/**
 * Builds Subjects, Decks and Concepts from YAML sources keyed by path:
 * `./<subject>/subject.yaml` and `./<subject>/decks/<deck>.yaml`.
 *
 * Ids in the files are unique within a Subject; the built ids are prefixed with the Subject id,
 * e.g. `german/number-3`.
 */
export function buildContent(files: Record<string, string>): Content {
  const content: Content = { subjects: [], decks: [], concepts: [] };
  const dirs = new Set(Object.keys(files).map((path) => path.split('/')[1]));

  for (const dir of dirs) {
    const subjectPath = `./${dir}/subject.yaml`;
    if (!(subjectPath in files)) {
      throw new Error(`${subjectPath}: missing`);
    }
    const subject = read(subjectPath, files[subjectPath], subjectSchema);
    if (content.subjects.some((other) => other.id === subject.id)) {
      throw new Error(`${subjectPath}: duplicate subject id "${subject.id}"`);
    }
    content.subjects.push(subject);

    const deckPaths = Object.keys(files).filter((path) => path.startsWith(`./${dir}/decks/`));
    const decks = deckPaths.map((path) => ({ path, deck: read(path, files[path], deckSchema) }));
    const conceptIds = new Set<string>();
    const deckIds = new Set<string>();

    for (const { path, deck } of decks) {
      checkUnique(deckIds, deck.id, `${path}: duplicate deck id`);
      for (const concept of deck.concepts) {
        checkUnique(conceptIds, concept.id, `${path}: duplicate concept id`);
        content.concepts.push({
          ...concept,
          id: `${subject.id}/${concept.id}`,
          subjectId: subject.id,
        });
      }
    }

    for (const { path, deck } of decks) {
      for (const included of deck.include) {
        if (!conceptIds.has(included)) {
          throw new Error(`${path}: included concept "${included}" is not defined in any deck`);
        }
      }
      const ids = [...deck.concepts.map((concept) => concept.id), ...deck.include];
      const listed = new Set<string>();
      for (const conceptId of ids) {
        checkUnique(listed, conceptId, `${path}: concept listed twice`);
      }
      content.decks.push({
        id: `${subject.id}/${deck.id}`,
        subjectId: subject.id,
        kind: deck.kind,
        name: deck.name,
        conceptIds: ids.map((conceptId) => `${subject.id}/${conceptId}`),
      });
    }
  }

  return content;
}

function read<T>(path: string, source: string, schema: z.ZodType<T>): T {
  // Failsafe keeps every value a string, so `null` (German zero) or `0` aren't converted.
  const result = schema.safeParse(parse(source, { schema: 'failsafe' }));
  if (!result.success) {
    throw new Error(`${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function checkUnique(seen: Set<string>, id: string, message: string) {
  if (seen.has(id)) {
    throw new Error(`${message} "${id}"`);
  }
  seen.add(id);
}

export const content = buildContent(
  import.meta.glob<string>('./*/**/*.yaml', { query: '?raw', import: 'default', eager: true }),
);

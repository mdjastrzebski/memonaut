import { parse } from 'yaml';
import { z } from 'zod';

import type { Concept, Deck, Subject } from '@/domain/types';
import { EXERCISE_TYPES } from '@/session/session';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes');

const subjectSchema = z.strictObject({
  id,
  name: z.string(),
  emoji: z.string().optional(),
  foreignLanguage: z.string(),
  specialCharacters: z.array(z.string()).optional(),
  /** Every Exercise Type if left out; kept in order from easiest whatever the order listed. */
  exerciseTypes: z
    .array(z.enum(EXERCISE_TYPES))
    .min(1)
    .default(EXERCISE_TYPES)
    .transform((listed) => EXERCISE_TYPES.filter((type) => listed.includes(type))),
});

const conceptSchema = z.strictObject({
  id,
  local: z.string().min(1).optional(),
  foreign: z.string().min(1),
  hint: z.string().optional(),
  spokenHint: z.string().min(1).optional(),
  /** Puts the Concept in the Subject's core Deck. */
  core: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const deckSchema = z.strictObject({
  id,
  name: z.string(),
  concepts: z.array(conceptSchema),
});

/** Concepts only in the core Deck; every one of them is core. */
const coreSchema = z.strictObject({
  concepts: z.array(conceptSchema.omit({ core: true })),
});

const CORE_DECK = { id: 'core', name: 'Essentials' };

export interface Content {
  subjects: Subject[];
  decks: Deck[];
  concepts: Concept[];
}

/**
 * Builds Subjects, Decks and Concepts from YAML sources keyed by path:
 * `./<subject>/subject.yaml`, `./<subject>/decks/<deck>.yaml`, each a unit Deck, and an optional
 * `./<subject>/core.yaml`.
 *
 * A Concept may appear in several files, defined the same way in each. The Subject's core Deck
 * holds the Concepts of `core.yaml` followed by those marked `core` in any unit, each once, in the
 * order they first appear.
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

    const prefix = (conceptId: string) => `${subject.id}/${conceptId}`;
    const deckPaths = Object.keys(files).filter((path) => path.startsWith(`./${dir}/decks/`));
    const concepts = new Map<string, Concept>();
    const deckIds = new Set<string>([CORE_DECK.id]);
    const coreIds = new Set<string>();

    const addConcept = (path: string, fields: Omit<Concept, 'subjectId'>) => {
      if (fields.local === undefined && subject.exerciseTypes.includes('translation')) {
        throw new Error(`${path}: concept "${fields.id}" needs a local word for translation`);
      }
      const concept = { ...fields, id: prefix(fields.id), subjectId: subject.id };
      const existing = concepts.get(fields.id);
      if (!existing) {
        concepts.set(fields.id, concept);
      } else if (!isSameConcept(existing, concept)) {
        throw new Error(`${path}: concept "${fields.id}" is defined differently in another deck`);
      }
    };

    const corePath = `./${dir}/core.yaml`;
    if (corePath in files) {
      const listed = new Set<string>();
      for (const fields of read(corePath, files[corePath], coreSchema).concepts) {
        checkUnique(listed, fields.id, `${corePath}: concept listed twice`);
        addConcept(corePath, fields);
        coreIds.add(fields.id);
      }
    }

    for (const path of deckPaths) {
      const deck = read(path, files[path], deckSchema);
      checkUnique(deckIds, deck.id, `${path}: duplicate deck id`);
      const listed = new Set<string>();
      for (const { core, ...fields } of deck.concepts) {
        checkUnique(listed, fields.id, `${path}: concept listed twice`);
        addConcept(path, fields);
        if (core) {
          coreIds.add(fields.id);
        }
      }
      content.decks.push({
        id: prefix(deck.id),
        subjectId: subject.id,
        kind: 'unit',
        name: deck.name,
        conceptIds: deck.concepts.map((concept) => prefix(concept.id)),
      });
    }

    content.concepts.push(...concepts.values());
    if (coreIds.size > 0) {
      content.decks.push({
        id: prefix(CORE_DECK.id),
        subjectId: subject.id,
        kind: 'core',
        name: CORE_DECK.name,
        conceptIds: [...coreIds].map(prefix),
      });
    }
  }

  return content;
}

function isSameConcept(a: Concept, b: Concept): boolean {
  return (
    a.local === b.local &&
    a.foreign === b.foreign &&
    a.hint === b.hint &&
    a.spokenHint === b.spokenHint
  );
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

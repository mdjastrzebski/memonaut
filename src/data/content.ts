import { parse } from 'yaml';
import { z } from 'zod';

import type { Concept, Deck, ExerciseType, Subject, SubjectKind } from '@/domain/types';
import { isGerman } from '@/exercises/german-articles';
import { canPractise, EXERCISE_TYPES, KIND_EXERCISE_TYPES } from '@/session/session';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, digits and dashes');

/** Narrower groups follow a slash, e.g. "number/small" within "number". */
const group = z
  .string()
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*$/,
    'Use lowercase letters, digits and dashes, with slashes between groups',
  );

/** Kept in order from easiest whatever the order listed. */
const exerciseTypes = z
  .array(z.enum(EXERCISE_TYPES))
  .min(1)
  .transform((listed) => EXERCISE_TYPES.filter((type) => listed.includes(type)));

const flag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const subjectFields = {
  id,
  name: z.string(),
  emoji: z.string().optional(),
  specialCharacters: z.array(z.string()).optional(),
  trickySpellings: z.array(z.string().min(1)).optional(),
};

/** Every Exercise Type of its kind the Subject can use if left out; see `getSubject`. */
const subjectExerciseTypes = (kind: SubjectKind) =>
  exerciseTypes
    .refine((listed) => listed.every((type) => KIND_EXERCISE_TYPES[kind].includes(type)), {
      message: `Use exercise types of a ${kind} subject: ${KIND_EXERCISE_TYPES[kind].join(', ')}`,
    })
    .optional();

const subjectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    ...subjectFields,
    kind: z.literal('language'),
    foreignLanguage: z.string(),
    exerciseTypes: subjectExerciseTypes('language'),
  }),
  z.strictObject({
    ...subjectFields,
    kind: z.literal('knowledge'),
    exerciseTypes: subjectExerciseTypes('knowledge'),
  }),
]);

/** A Concept's fields in the files, by its Subject's kind. */
const CONCEPT_FIELDS = {
  language: {
    local: z.string().min(1).optional(),
    foreign: z.string().min(1),
    /** Other right answers in translation. */
    alternatives: z.array(z.string().min(1)).min(1).optional(),
    hint: z.string().optional(),
    spokenHint: z.string().min(1).optional(),
    /** Shown with the result, e.g. how a plural is made. */
    explanation: z.string().min(1).optional(),
    /** Groups like Concepts of the Subject, e.g. "weekday", for multiple choice. */
    group: group.optional(),
    /** A plural noun, which skips German article choice. */
    plural: z
      .literal('true')
      .transform(() => true)
      .optional(),
  },
  knowledge: {
    question: z.string().min(1),
    answer: z.string().min(1),
    explanation: z.string().min(1).optional(),
    /** Wrong answers, for question choice. */
    choices: z.array(z.string().min(1)).min(1).optional(),
  },
} satisfies Record<SubjectKind, z.ZodRawShape>;

/** Its fields are checked by the schema for its Subject's kind. */
type ConceptFields = { id: string } & Record<string, string | string[] | undefined>;

const deckSchema = (kind: SubjectKind) =>
  z.strictObject({
    id,
    name: z.string(),
    /** Hides the Deck and leaves its Concepts out of the core Deck; it is still checked. */
    disabled: flag,
    strictSpelling: flag,
    shuffleNew: flag,
    /** The Subject's if left out. */
    exerciseTypes: exerciseTypes.optional(),
    concepts: z.array(
      z.strictObject({
        id,
        ...CONCEPT_FIELDS[kind],
        /** Puts the Concept in the Subject's core Deck. */
        core: flag,
      }) as unknown as z.ZodType<ConceptFields & { core: boolean }>,
    ),
  });

/** Concepts only in the core Deck; every one of them is core. Its options apply to the core Deck. */
const coreSchema = (kind: SubjectKind) =>
  z.strictObject({
    strictSpelling: flag,
    shuffleNew: flag,
    exerciseTypes: exerciseTypes.optional(),
    concepts: z.array(
      z.strictObject({ id, ...CONCEPT_FIELDS[kind] }) as unknown as z.ZodType<ConceptFields>,
    ),
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
 * order they first appear. A `disabled` unit is checked but left out, along with its Concepts, unless
 * another Deck has them.
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
    const subject = getSubject(subjectPath, read(subjectPath, files[subjectPath], subjectSchema));
    if (content.subjects.some((other) => other.id === subject.id)) {
      throw new Error(`${subjectPath}: duplicate subject id "${subject.id}"`);
    }
    content.subjects.push(subject);

    const prefix = (conceptId: string) => `${subject.id}/${conceptId}`;
    const deckPaths = Object.keys(files).filter((path) => path.startsWith(`./${dir}/decks/`));
    const concepts = new Map<string, Concept>();
    const deckIds = new Set<string>([CORE_DECK.id]);
    const coreIds = new Set<string>();
    /** Concepts of the Decks built, as a disabled unit's are left out. */
    const usedIds = new Set<string>();
    let coreStrictSpelling = false;
    let coreShuffleNew = false;
    let coreExerciseTypes = subject.exerciseTypes;

    const getExerciseTypes = (path: string, listed?: ExerciseType[]) => {
      const extra = listed?.find((type) => !subject.exerciseTypes.includes(type));
      if (extra) {
        throw new Error(`${path}: exercise type "${extra}" is not one of the subject's`);
      }
      return listed ?? subject.exerciseTypes;
    };

    const addConcept = (path: string, fields: ConceptFields) => {
      const needingLocal = subject.exerciseTypes.find((type) => type !== 'dictation');
      if (subject.kind === 'language' && fields.local === undefined && needingLocal) {
        throw new Error(`${path}: concept "${fields.id}" needs a local word for ${needingLocal}`);
      }
      const concept = {
        ...fields,
        kind: subject.kind,
        id: prefix(fields.id),
        subjectId: subject.id,
      } as Concept;
      if (concept.kind === 'knowledge' && concept.choices?.includes(concept.answer)) {
        throw new Error(`${path}: concept "${fields.id}" has its answer among its wrong choices`);
      }
      const existing = concepts.get(fields.id);
      if (!existing) {
        concepts.set(fields.id, concept);
      } else if (!isSameConcept(existing, concept)) {
        throw new Error(`${path}: concept "${fields.id}" is defined differently in another deck`);
      }
    };

    /** Fewer Exercise Types for the Concepts that can't be practised with all of the Deck's. */
    const getFewerExerciseTypes = (
      path: string,
      conceptIds: string[],
      exerciseTypes: ExerciseType[],
    ): Pick<Deck, 'conceptExerciseTypes'> => {
      const fewer: Record<string, ExerciseType[]> = {};
      for (const conceptId of conceptIds) {
        const concept = concepts.get(conceptId)!;
        const types = exerciseTypes.filter((type) => canPractise(concept, type, subject));
        if (types.length === 0) {
          throw new Error(`${path}: concept "${conceptId}" fits none of the deck's exercise types`);
        }
        if (types.length < exerciseTypes.length) fewer[prefix(conceptId)] = types;
      }
      return Object.keys(fewer).length > 0 ? { conceptExerciseTypes: fewer } : {};
    };

    const corePath = `./${dir}/core.yaml`;
    if (corePath in files) {
      const listed = new Set<string>();
      const core = read(corePath, files[corePath], coreSchema(subject.kind));
      coreStrictSpelling = core.strictSpelling;
      coreShuffleNew = core.shuffleNew;
      coreExerciseTypes = getExerciseTypes(corePath, core.exerciseTypes);
      for (const fields of core.concepts) {
        checkUnique(listed, fields.id, `${corePath}: concept listed twice`);
        addConcept(corePath, fields);
        coreIds.add(fields.id);
      }
    }

    for (const path of deckPaths) {
      const deck = read(path, files[path], deckSchema(subject.kind));
      checkUnique(deckIds, deck.id, `${path}: duplicate deck id`);
      const listed = new Set<string>();
      for (const { core, ...fields } of deck.concepts) {
        checkUnique(listed, fields.id, `${path}: concept listed twice`);
        addConcept(path, fields);
        if (core && !deck.disabled) {
          coreIds.add(fields.id);
        }
      }
      if (deck.disabled) continue;
      const exerciseTypes = getExerciseTypes(path, deck.exerciseTypes);
      const conceptIds = deck.concepts.map((concept) => concept.id);
      conceptIds.forEach((conceptId) => usedIds.add(conceptId));
      content.decks.push({
        id: prefix(deck.id),
        subjectId: subject.id,
        kind: 'unit',
        name: deck.name,
        conceptIds: conceptIds.map(prefix),
        ...(deck.strictSpelling && { strictSpelling: true }),
        ...(deck.shuffleNew && { shuffleNew: true }),
        exerciseTypes,
        ...getFewerExerciseTypes(path, conceptIds, exerciseTypes),
      });
    }

    coreIds.forEach((conceptId) => usedIds.add(conceptId));
    content.concepts.push(...[...concepts].filter(([id]) => usedIds.has(id)).map(([, c]) => c));
    if (coreIds.size > 0) {
      content.decks.push({
        id: prefix(CORE_DECK.id),
        subjectId: subject.id,
        kind: 'core',
        name: CORE_DECK.name,
        conceptIds: [...coreIds].map(prefix),
        ...(coreStrictSpelling && { strictSpelling: true }),
        ...(coreShuffleNew && { shuffleNew: true }),
        exerciseTypes: coreExerciseTypes,
        ...getFewerExerciseTypes(`./${dir}: core deck`, [...coreIds], coreExerciseTypes),
      });
    }
  }

  return content;
}

/**
 * The Subject with its Exercise Types: every one of its kind if left out, but German article choice
 * only in German.
 */
function getSubject(path: string, fields: z.infer<typeof subjectSchema>): Subject {
  const subject = { ...fields, exerciseTypes: KIND_EXERCISE_TYPES[fields.kind] };
  const german = isGerman(subject);
  if (fields.exerciseTypes?.includes('article-choice-de') && !german) {
    throw new Error(`${path}: exercise type "article-choice-de" needs a German subject`);
  }
  const exerciseTypes =
    fields.exerciseTypes ??
    subject.exerciseTypes.filter((type) => type !== 'article-choice-de' || german);
  return { ...subject, exerciseTypes };
}

function isSameConcept(a: Concept, b: Concept): boolean {
  const fields = (concept: Concept): Record<string, unknown> => ({ ...concept });
  const [first, second] = [fields(a), fields(b)];
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  // Compared as JSON, so lists like choices count as the same when they have the same items.
  return [...keys].every((key) => JSON.stringify(first[key]) === JSON.stringify(second[key]));
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

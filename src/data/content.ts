import { parse } from 'yaml';
import { z } from 'zod';

import type { Concept, Deck, ExerciseType, Subject, SubjectKind } from '@/domain/types';
import { splitCloze } from '@/exercises/cloze';
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

/** A flag that is on unless set to false. */
const onFlag = z
  .enum(['true', 'false'])
  .default('true')
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
    /** The local plural, for translation plural; needs `foreignPlural`. */
    localPlural: z.string().min(1).optional(),
    /** The foreign plural, for plural form and translation plural. */
    foreignPlural: z.string().min(1).optional(),
  },
  knowledge: {
    question: z.string().min(1),
    answer: z.string().min(1),
    explanation: z.string().min(1).optional(),
    /** Wrong answers, for question choice. */
    choices: z.array(z.string().min(1)).min(1).optional(),
  },
} satisfies Record<SubjectKind, z.ZodRawShape>;

/** A cloze sentence's fields in a language Subject: its id starts with "cloze-". */
const CLOZE_FIELDS = {
  id: id.regex(/^cloze-/, 'Start the id of a cloze sentence with "cloze-"'),
  /** The sentence with one gap in square brackets. */
  cloze: z.string().min(1),
  hint: z.string().optional(),
  explanation: z.string().min(1).optional(),
};

/** Its fields are checked by the schema for its Subject's kind. */
type ConceptFields = { id: string } & Record<string, string | string[] | undefined>;

/**
 * A Concept in a file: of its Subject's kind, or in a language Subject a cloze sentence when it has
 * a `cloze`, each with its own fields.
 */
function conceptSchema<T extends z.ZodRawShape>(kind: SubjectKind, extra: T) {
  const own = z.strictObject({ id, ...CONCEPT_FIELDS[kind], ...extra });
  if (kind !== 'language') return own as unknown as z.ZodType<ConceptFields>;
  const cloze = z.strictObject({ ...CLOZE_FIELDS, ...extra });
  return z.unknown().transform((value, ctx) => {
    const isCloze = typeof value === 'object' && value !== null && 'cloze' in value;
    const result = (isCloze ? cloze : own).safeParse(value);
    if (!result.success) {
      ctx.issues.push(...(result.error.issues as typeof ctx.issues));
      return z.NEVER;
    }
    return result.data;
  }) as unknown as z.ZodType<ConceptFields>;
}

const deckSchema = (kind: SubjectKind) =>
  z.strictObject({
    id,
    name: z.string(),
    /** Hides the Deck and leaves its Concepts out of the core Deck; it is still checked. */
    disabled: flag,
    strictSpelling: flag,
    shuffleNew: flag,
    showIntro: onFlag,
    /** The Subject's if left out. */
    exerciseTypes: exerciseTypes.optional(),
    concepts: z.array(
      conceptSchema(kind, {
        /** Puts the Concept in the Subject's core Deck. */
        core: flag,
        /** Introduces the Concept before the Deck's other new ones; needs `shuffleNew`. */
        priority: flag,
      }) as unknown as z.ZodType<ConceptFields & { core: boolean; priority: boolean }>,
    ),
  });

/** Concepts only in the core Deck; every one of them is core. Its options apply to the core Deck. */
const coreSchema = (kind: SubjectKind) =>
  z.strictObject({
    strictSpelling: flag,
    shuffleNew: flag,
    showIntro: onFlag,
    exerciseTypes: exerciseTypes.optional(),
    concepts: z.array(conceptSchema(kind, {})),
  });

const CORE_DECK = { id: 'core', name: 'Essentials' };

export interface Content {
  subjects: Subject[];
  decks: Deck[];
  concepts: Concept[];
}

/**
 * Subjects and unit Decks the user added on top of the bundled files, each as parsed from its YAML
 * (see `@/data/user-sets`). A Deck belongs to a bundled Subject or to one of `subjects`.
 */
export interface UserContent {
  subjects: unknown[];
  decks: { subjectId: string; deck: unknown }[];
}

/** Where errors in the user's own Subjects and Decks point to. */
const USER_PATH = 'my sets';

/** A Subject's parsed files: its fields, optional core list and unit Decks. */
interface SubjectSource {
  path: string;
  fields: unknown;
  core?: { path: string; value: unknown };
  decks: { path: string; value: unknown; custom: boolean }[];
  custom: boolean;
}

/**
 * Builds Subjects, Decks and Concepts from YAML sources keyed by path:
 * `./<subject>/subject.yaml`, `./<subject>/decks/<deck>.yaml`, each a unit Deck, and an optional
 * `./<subject>/core.yaml`, then adds the user's own Subjects and Decks.
 *
 * A Concept may appear in several files, defined the same way in each, except that a user's Deck
 * may define it differently: its definition is then used everywhere, and of two user Decks, the
 * later one's. The Subject's core Deck holds the Concepts of `core.yaml` followed by those marked
 * `core` in any unit, each once, in the order they first appear. A `disabled` unit is checked but
 * left out, along with its Concepts, unless another Deck has them.
 *
 * Ids in the files are unique within a Subject; the built ids are prefixed with the Subject id,
 * e.g. `german/number-3`.
 */
export function buildContent(
  files: Record<string, string>,
  user: UserContent = { subjects: [], decks: [] },
): Content {
  const content: Content = { subjects: [], decks: [], concepts: [] };
  const dirs = new Set(Object.keys(files).map((path) => path.split('/')[1]));
  const sources: SubjectSource[] = [];

  for (const dir of dirs) {
    const subjectPath = `./${dir}/subject.yaml`;
    if (!(subjectPath in files)) {
      throw new Error(`${subjectPath}: missing`);
    }
    const corePath = `./${dir}/core.yaml`;
    sources.push({
      path: subjectPath,
      fields: parseYaml(subjectPath, files[subjectPath]),
      ...(corePath in files && {
        core: { path: corePath, value: parseYaml(corePath, files[corePath]) },
      }),
      decks: Object.keys(files)
        .filter((path) => path.startsWith(`./${dir}/decks/`))
        .map((path) => ({ path, value: parseYaml(path, files[path]), custom: false })),
      custom: false,
    });
  }
  for (const fields of user.subjects) {
    sources.push({
      path: `${USER_PATH}: subject "${getFieldId(fields)}"`,
      fields,
      decks: [],
      custom: true,
    });
  }

  const subjects = sources.map((source) => {
    const subject = getSubject(source.path, validate(source.path, source.fields, subjectSchema));
    if (content.subjects.some((other) => other.id === subject.id)) {
      throw new Error(`${source.path}: duplicate subject id "${subject.id}"`);
    }
    content.subjects.push(source.custom ? { ...subject, custom: true } : subject);
    return subject;
  });
  for (const { subjectId, deck } of user.decks) {
    const path = `${USER_PATH}: ${subjectId}/${getFieldId(deck)}`;
    const index = subjects.findIndex((subject) => subject.id === subjectId);
    if (index < 0) {
      throw new Error(`${path}: no subject "${subjectId}"`);
    }
    sources[index].decks.push({ path, value: deck, custom: true });
  }

  sources.forEach((source, index) => addSubject(content, subjects[index], source));
  return content;
}

/** Adds the Subject's Decks and Concepts to the content. */
function addSubject(content: Content, subject: Subject, source: SubjectSource) {
  const prefix = (conceptId: string) => `${subject.id}/${conceptId}`;
  const concepts = new Map<string, Concept>();
  const deckIds = new Set<string>([CORE_DECK.id]);
  const coreIds = new Set<string>();
  /** Concepts of the Decks built, as a disabled unit's are left out. */
  const usedIds = new Set<string>();
  /** Built once every Concept is known, as a user's Deck may change one defined earlier. */
  const buildDecks: (() => Deck)[] = [];
  let coreStrictSpelling = false;
  let coreShuffleNew = false;
  let coreShowIntro = true;
  let coreExerciseTypes = subject.exerciseTypes;

  const getExerciseTypes = (path: string, listed?: ExerciseType[]) => {
    const extra = listed?.find((type) => !subject.exerciseTypes.includes(type));
    if (extra) {
      throw new Error(`${path}: exercise type "${extra}" is not one of the subject's`);
    }
    return listed ?? subject.exerciseTypes;
  };

  /** A user's Deck may `redefine` a Concept defined earlier. */
  const addConcept = (path: string, fields: ConceptFields, redefine = false) => {
    const isCloze = fields.cloze !== undefined;
    const needingLocal = subject.exerciseTypes.find(
      (type) => type !== 'dictation' && type !== 'cloze',
    );
    if (subject.kind === 'language' && !isCloze && fields.local === undefined && needingLocal) {
      throw new Error(`${path}: concept "${fields.id}" needs a local word for ${needingLocal}`);
    }
    const concept = {
      ...fields,
      kind: isCloze ? 'cloze' : subject.kind,
      id: prefix(fields.id),
      subjectId: subject.id,
    } as Concept;
    if (concept.kind === 'language' && concept.localPlural && !concept.foreignPlural) {
      throw new Error(`${path}: concept "${fields.id}" has a local plural but no foreign plural`);
    }
    if (concept.kind === 'language' && concept.plural && concept.foreignPlural) {
      throw new Error(`${path}: concept "${fields.id}" is a plural, so it has no foreign plural`);
    }
    if (concept.kind === 'cloze' && !splitCloze(concept.cloze)) {
      throw new Error(
        `${path}: concept "${fields.id}" needs one gap in square brackets in its cloze`,
      );
    }
    if (concept.kind === 'knowledge' && concept.choices?.includes(concept.answer)) {
      throw new Error(`${path}: concept "${fields.id}" has its answer among its wrong choices`);
    }
    const existing = concepts.get(fields.id);
    if (!existing || redefine) {
      concepts.set(fields.id, concept);
    } else if (!isSameConcept(existing, concept)) {
      throw new Error(`${path}: concept "${fields.id}" is defined differently in another deck`);
    }
  };

  /**
   * The Deck's Exercise Types that any of its Concepts can be practised with, e.g. none of the
   * plural ones without plurals, and fewer for the Concepts that can't be practised with all.
   */
  const getDeckExerciseTypes = (
    path: string,
    conceptIds: string[],
    exerciseTypes: ExerciseType[],
  ): Pick<Deck, 'exerciseTypes' | 'conceptExerciseTypes'> => {
    const conceptTypes = new Map<string, ExerciseType[]>();
    for (const conceptId of conceptIds) {
      const concept = concepts.get(conceptId)!;
      const types = exerciseTypes.filter((type) => canPractise(concept, type, subject));
      if (types.length === 0) {
        throw new Error(`${path}: concept "${conceptId}" fits none of the deck's exercise types`);
      }
      conceptTypes.set(conceptId, types);
    }
    const used = exerciseTypes.filter((type) =>
      [...conceptTypes.values()].some((types) => types.includes(type)),
    );
    const fewer: Record<string, ExerciseType[]> = {};
    for (const [conceptId, types] of conceptTypes) {
      if (types.length < used.length) fewer[prefix(conceptId)] = types;
    }
    return {
      exerciseTypes: used,
      ...(Object.keys(fewer).length > 0 && { conceptExerciseTypes: fewer }),
    };
  };

  if (source.core) {
    const { path: corePath, value } = source.core;
    const listed = new Set<string>();
    const core = validate(corePath, value, coreSchema(subject.kind));
    coreStrictSpelling = core.strictSpelling;
    coreShuffleNew = core.shuffleNew;
    coreShowIntro = core.showIntro;
    coreExerciseTypes = getExerciseTypes(corePath, core.exerciseTypes);
    for (const fields of core.concepts) {
      checkUnique(listed, fields.id, `${corePath}: concept listed twice`);
      addConcept(corePath, fields);
      coreIds.add(fields.id);
    }
  }

  for (const { path, value, custom } of source.decks) {
    const deck = validate(path, value, deckSchema(subject.kind));
    checkUnique(deckIds, deck.id, `${path}: duplicate deck id`);
    const listed = new Set<string>();
    const priorityIds: string[] = [];
    for (const { core, priority, ...fields } of deck.concepts) {
      checkUnique(listed, fields.id, `${path}: concept listed twice`);
      if (priority && !deck.shuffleNew) {
        throw new Error(`${path}: concept "${fields.id}" is marked priority without shuffleNew`);
      }
      addConcept(path, fields, custom);
      if (priority) {
        priorityIds.push(fields.id);
      }
      if (core && !deck.disabled) {
        coreIds.add(fields.id);
      }
    }
    if (deck.disabled) continue;
    const exerciseTypes = getExerciseTypes(path, deck.exerciseTypes);
    const conceptIds = deck.concepts.map((concept) => concept.id);
    conceptIds.forEach((conceptId) => usedIds.add(conceptId));
    buildDecks.push(() => ({
      id: prefix(deck.id),
      subjectId: subject.id,
      kind: 'unit',
      name: deck.name,
      conceptIds: conceptIds.map(prefix),
      ...(deck.strictSpelling && { strictSpelling: true }),
      ...(deck.shuffleNew && { shuffleNew: true }),
      ...(priorityIds.length > 0 && { priorityConceptIds: priorityIds.map(prefix) }),
      ...(!deck.showIntro && { showIntro: false }),
      ...getDeckExerciseTypes(path, conceptIds, exerciseTypes),
      ...(custom && { custom: true }),
    }));
  }

  content.decks.push(...buildDecks.map((build) => build()));
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
      ...(!coreShowIntro && { showIntro: false }),
      ...getDeckExerciseTypes(`${source.path}: core deck`, [...coreIds], coreExerciseTypes),
    });
  }
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

/** Parsed with the failsafe schema, which keeps every value a string, so `null` (German zero) or
 * `0` aren't converted. */
export function parseYaml(path: string, source: string): unknown {
  try {
    return parse(source, { schema: 'failsafe' });
  } catch (error) {
    throw new Error(`${path}: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
}

function validate<T>(path: string, value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(`${path}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** The `id` of parsed fields, for errors before they're checked. */
function getFieldId(fields: unknown): string {
  const id = typeof fields === 'object' && fields !== null && 'id' in fields ? fields.id : null;
  return typeof id === 'string' ? id : '?';
}

function checkUnique(seen: Set<string>, id: string, message: string) {
  if (seen.has(id)) {
    throw new Error(`${message} "${id}"`);
  }
  seen.add(id);
}

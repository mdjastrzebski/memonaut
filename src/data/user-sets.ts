import { buildContent, parseYaml, type Content, type UserContent } from '@/data/content';
import type { Deck, Subject, SubjectKind } from '@/domain/types';

/**
 * The user's own Subjects and Decks, kept in localStorage apart from learning progress, one key
 * each, as parsed from their YAML:
 *
 * - `memonaut:subject:<subject>`: a Subject, e.g.
 *   `{ "version": 1, "addedAt": "2026-10-23T…", "subject": { "id": "french", "name": "French", "kind": "language", "foreignLanguage": "fr-FR" } }`
 * - `memonaut:set:<subject>:<deck>`: a unit Deck of a bundled or user Subject, e.g.
 *   `{ "version": 1, "addedAt": "…", "updatedAt": "…", "deck": { "id": "food", "name": "Food", "concepts": [{ "id": "bread", … }] } }`
 *
 * They're built after the bundled content, in the order added (see `buildContent`), so a user's
 * Deck can redefine a bundled Concept. Importing a Deck with the id of one already imported
 * replaces it in its place; progress is keyed by Concept id, so it's kept.
 */
const VERSION = 1;
const SUBJECT_PREFIX = 'memonaut:subject:';
const SET_PREFIX = 'memonaut:set:';

const getSubjectKey = (subjectId: string) => `${SUBJECT_PREFIX}${subjectId}`;
const getSetKey = (subjectId: string, deckId: string) => `${SET_PREFIX}${subjectId}:${deckId}`;

interface StoredSubject {
  key: string;
  addedAt: string;
  subject: Record<string, unknown>;
}

interface StoredSet {
  key: string;
  subjectId: string;
  addedAt: string;
  deck: Record<string, unknown>;
}

/** A stored Subject or Deck that can't be built, e.g. after an app update, and is left out. */
export interface BrokenSet {
  key: string;
  name: string;
  error: string;
}

/** What `loadContent` built, and the user's Subjects and Decks it left out. */
export interface LoadedContent {
  content: Content;
  broken: BrokenSet[];
}

export type SaveResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * The bundled content with the user's Subjects and Decks. One that can't be built is left out, so
 * it never keeps the app from starting, and reported in `broken`.
 */
export function loadContent(files: Record<string, string>): LoadedContent {
  return build(files, readStored());
}

/** The id and name a Deck's YAML gives, if it reads as a Deck, e.g. to ask before replacing it. */
export function readDeckHeader(yaml: string): { id: string; name: string } | null {
  try {
    const value = parseYaml('', yaml);
    if (!isObject(value) || typeof value.id !== 'string') return null;
    return { id: value.id, name: typeof value.name === 'string' ? value.name : value.id };
  } catch {
    return null;
  }
}

/**
 * Saves a Deck from its YAML into a Subject, replacing an imported one with the same id. Saves
 * nothing when the Deck doesn't build with the rest of the content.
 */
export function importDeck(
  files: Record<string, string>,
  subjectId: string,
  yaml: string,
  now = new Date(),
): SaveResult<Deck> {
  let deck: unknown;
  try {
    deck = parseYaml('file', yaml);
  } catch (error) {
    return { ok: false, error: getMessage(error) };
  }
  if (!isObject(deck) || typeof deck.id !== 'string') {
    return { ok: false, error: 'The file is not a set: it needs an id, a name and concepts.' };
  }
  const stored = readStored();
  const key = getSetKey(subjectId, deck.id);
  const existing = stored.sets.find((set) => set.key === key);
  const set: StoredSet = { key, subjectId, addedAt: existing?.addedAt ?? now.toISOString(), deck };
  const sets = existing
    ? stored.sets.map((other) => (other === existing ? set : other))
    : [...stored.sets, set];

  const accepted = build(files, stored);
  const error = tryBuild(files, {
    subjects: stored.subjects.filter((subject) => isAccepted(accepted, subject.key)),
    sets: sets.filter((other) => other === set || isAccepted(accepted, other.key)),
  });
  if (error) return { ok: false, error };
  const value = {
    version: VERSION,
    addedAt: set.addedAt,
    updatedAt: now.toISOString(),
    deck,
  };
  if (!write(key, value)) return { ok: false, error: 'Could not save the set on this device.' };
  const built = loadContent(files).content.decks.find(
    (built) => built.id === `${subjectId}/${String(deck.id)}`,
  );
  return built ? { ok: true, value: built } : { ok: false, error: 'Could not load the set.' };
}

export interface NewSubject {
  name: string;
  emoji?: string;
  kind: SubjectKind;
  /** BCP 47 tag of the language read aloud, for a language Subject, e.g. "fr-FR". */
  foreignLanguage?: string;
  specialCharacters?: string[];
}

/** Saves a new Subject of the user's, with an id made from its name. */
export function addSubject(
  files: Record<string, string>,
  fields: NewSubject,
  now = new Date(),
): SaveResult<Subject> {
  const name = fields.name.trim();
  if (!name) return { ok: false, error: 'Give the subject a name.' };
  const { content } = loadContent(files);
  if (content.subjects.some((subject) => subject.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: `There's already a subject named ${name}.` };
  }
  // Progress of a removed Subject stays, so the id of one with the same name brings it back.
  const base = toId(name) || 'subject';
  const taken = new Set(content.subjects.map((subject) => subject.id));
  let id = base;
  for (let index = 2; taken.has(id); index++) id = `${base}-${index}`;

  const emoji = fields.emoji?.trim();
  const subject: Record<string, unknown> = {
    id,
    name,
    kind: fields.kind,
    ...(emoji && { emoji }),
    ...(fields.kind === 'language' && { foreignLanguage: fields.foreignLanguage ?? '' }),
    ...(fields.kind === 'language' &&
      fields.specialCharacters?.length && { specialCharacters: fields.specialCharacters }),
  };
  const stored = readStored();
  const accepted = build(files, stored);
  const entry: StoredSubject = { key: getSubjectKey(id), addedAt: now.toISOString(), subject };
  const error = tryBuild(files, {
    subjects: [...stored.subjects.filter((other) => isAccepted(accepted, other.key)), entry],
    sets: [],
  });
  if (error) return { ok: false, error };
  if (!write(entry.key, { version: VERSION, addedAt: entry.addedAt, subject })) {
    return { ok: false, error: 'Could not save the subject on this device.' };
  }
  const built = loadContent(files).content.subjects.find((subject) => subject.id === id);
  return built ? { ok: true, value: built } : { ok: false, error: 'Could not load the subject.' };
}

/** Removes an imported Deck; its progress stays, so importing it again brings it back. */
export function removeDeck(subjectId: string, deckId: string): boolean {
  return remove([getSetKey(subjectId, deckId)]);
}

/** Removes a stored Subject or Deck that can't be built. */
export function removeBroken(key: string): boolean {
  return remove([key]);
}

/** Removes a Subject of the user's with its Decks; its progress stays. */
export function removeSubject(subjectId: string): boolean {
  const sets = readStored().sets.filter((set) => set.subjectId === subjectId);
  return remove([getSubjectKey(subjectId), ...sets.map((set) => set.key)]);
}

interface Stored {
  subjects: StoredSubject[];
  sets: StoredSet[];
}

/** What's stored, and what can't be read, e.g. from a newer app version. */
function readStored(): { subjects: StoredSubject[]; sets: StoredSet[]; unreadable: BrokenSet[] } {
  const subjects: StoredSubject[] = [];
  const sets: StoredSet[] = [];
  const unreadable: BrokenSet[] = [];
  for (const key of storedKeys()) {
    const value = read(key);
    const isSubject = key.startsWith(SUBJECT_PREFIX);
    const fields = isSubject ? value?.subject : value?.deck;
    if (!value || !isObject(fields) || Number(value.version) > VERSION) {
      const name = isObject(fields) && typeof fields.name === 'string' ? fields.name : key;
      unreadable.push({ key, name, error: 'Saved by a newer version of Memonaut, or damaged.' });
      continue;
    }
    const addedAt = typeof value.addedAt === 'string' ? value.addedAt : '';
    if (isSubject) {
      subjects.push({ key, addedAt, subject: fields });
    } else {
      const subjectId = key.slice(SET_PREFIX.length).split(':')[0];
      sets.push({ key, subjectId, addedAt, deck: fields });
    }
  }
  const byAdded = (a: { addedAt: string }, b: { addedAt: string }) =>
    a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0;
  return { subjects: subjects.sort(byAdded), sets: sets.sort(byAdded), unreadable };
}

/**
 * Builds everything at once, or when that fails, adds the user's Subjects and Decks one by one,
 * leaving out those that fail.
 */
function build(
  files: Record<string, string>,
  { subjects, sets, unreadable }: ReturnType<typeof readStored>,
): LoadedContent {
  const all = { subjects, sets };
  if (!tryBuild(files, all)) {
    return { content: buildContent(files, toUserContent(all)), broken: unreadable };
  }
  const broken = [...unreadable];
  const accepted: Stored = { subjects: [], sets: [] };
  for (const subject of subjects) {
    const error = tryBuild(files, { ...accepted, subjects: [...accepted.subjects, subject] });
    if (error)
      broken.push({ key: subject.key, name: String(subject.subject.name ?? subject.key), error });
    else accepted.subjects.push(subject);
  }
  for (const set of sets) {
    const error = tryBuild(files, { ...accepted, sets: [...accepted.sets, set] });
    if (error) broken.push({ key: set.key, name: String(set.deck.name ?? set.key), error });
    else accepted.sets.push(set);
  }
  return { content: buildContent(files, toUserContent(accepted)), broken };
}

function isAccepted(loaded: LoadedContent, key: string): boolean {
  return !loaded.broken.some((broken) => broken.key === key);
}

/** The error building with these fails with, if any. */
function tryBuild(files: Record<string, string>, stored: Stored): string | null {
  try {
    buildContent(files, toUserContent(stored));
    return null;
  } catch (error) {
    return getMessage(error);
  }
}

function toUserContent({ subjects, sets }: Stored): UserContent {
  return {
    subjects: subjects.map((stored) => stored.subject),
    decks: sets.map((set) => ({ subjectId: set.subjectId, deck: set.deck })),
  };
}

/** A Subject id from its name, e.g. "francais" for "Français". */
function toId(name: string): string {
  return name
    .toLowerCase()
    .replace(/ł/g, 'l')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedKeys(): string[] {
  try {
    return Object.keys(localStorage).filter(
      (key) => key.startsWith(SUBJECT_PREFIX) || key.startsWith(SET_PREFIX),
    );
  } catch {
    return [];
  }
}

function read(key: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return isObject(value) ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Storage is full or blocked, e.g. in private mode.
    return false;
  }
}

function remove(keys: string[]): boolean {
  try {
    keys.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch {
    return false;
  }
}

import { z } from 'zod';

import { MAX_SESSIONS } from '@/progress/effort-log';
import { getProgressKey, mergeStoredProgress } from '@/progress/progress-storage';

/**
 * A backup of everything Memonaut keeps in localStorage, to move progress to another device or
 * keep it safe: a JSON file holding each stored value as it is, keyed by its storage key:
 *
 * ```json
 * { "app": "memonaut", "version": 1, "exportedAt": "2026-10-18T…", "data": { "memonaut:progress:german": "{…}" } }
 * ```
 *
 * The ElevenLabs key stays out, as it's a secret, and so does the theme, as it belongs to the
 * device. Importing merges a backup into what's stored, so progress from two devices adds up:
 *
 * - each word's Exercise Type keeps the later repetition (see `mergeStoredProgress`),
 * - sessions and the effort log keep the sessions of both, told apart by when they started,
 * - other values, like the pace and setup choice, stay as they are and are only taken from the
 *   backup when this device has none.
 */
const VERSION = 1;
/** The version of the stored sessions and effort log this app reads. */
const SESSIONS_VERSION = 1;
const PREFIX = 'memonaut:';
const EXCLUDED_KEYS = ['memonaut:elevenlabs-key', 'memonaut:theme'];

const backupSchema = z.object({
  app: z.literal('memonaut'),
  version: z.number().max(VERSION),
  exportedAt: z.string().optional(),
  data: z.record(z.string(), z.string()),
});

const isBackedUp = (key: string) => key.startsWith(PREFIX) && !EXCLUDED_KEYS.includes(key);

/** The stored values as a backup file's text. */
export function createBackup(now = new Date()): string {
  const data: Record<string, string> = {};
  for (const key of storedKeys()) {
    const value = localStorage.getItem(key);
    if (value !== null) data[key] = value;
  }
  return JSON.stringify(
    { app: 'memonaut', version: VERSION, exportedAt: now.toISOString(), data },
    null,
    2,
  );
}

/** A backup file's name, dated so several can sit side by side. */
export function getBackupFileName(now = new Date()): string {
  return `memonaut-progress-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Merges a backup into the stored values. Returns false, changing nothing, when the text isn't a
 * backup this version can read or storage can't be written.
 */
export function importBackup(text: string): boolean {
  let backup: z.infer<typeof backupSchema>;
  try {
    const parsed = backupSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return false;
    backup = parsed.data;
  } catch {
    return false;
  }

  const previous = new Map<string, string | null>();
  try {
    for (const [key, imported] of Object.entries(backup.data)) {
      if (!isBackedUp(key)) continue;
      const local = localStorage.getItem(key);
      previous.set(key, local);
      localStorage.setItem(key, merge(key, local, imported));
    }
    return true;
  } catch {
    // Storage is full or blocked; what was there before is put back, as far as it goes.
    try {
      for (const [key, value] of previous) {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      }
    } catch {
      // Nothing more can be done.
    }
    return false;
  }
}

function merge(key: string, local: string | null, imported: string): string {
  if (key.startsWith(getProgressKey(''))) return mergeStoredProgress(local, imported);
  if (key === 'memonaut:sessions') return mergeSessions(local, imported);
  if (key === 'memonaut:effort-log') return mergeSessions(local, imported, MAX_SESSIONS);
  return local ?? imported;
}

/**
 * Stored `{ "version": 1, "sessions": [...] }` with the sessions of both, oldest first. A session
 * in both is the same one, saved again as it went on, so the copy with more practice time wins.
 */
function mergeSessions(local: string | null, imported: string, max = Infinity): string {
  const parse = (raw: string | null) => {
    try {
      const value: unknown = JSON.parse(raw ?? 'null');
      return isObject(value) &&
        Array.isArray(value.sessions) &&
        !(Number(value.version) > SESSIONS_VERSION)
        ? (value as Record<string, unknown> & { sessions: unknown[] })
        : null;
    } catch {
      return null;
    }
  };
  const ours = parse(local);
  const theirs = parse(imported);
  if (local === null) return imported;
  if (!ours || !theirs) return local;

  const byStart = new Map<string, unknown>();
  const unknown: unknown[] = [];
  for (const session of [...ours.sessions, ...theirs.sessions]) {
    if (!isObject(session) || typeof session.startedAt !== 'string') {
      unknown.push(session);
      continue;
    }
    const kept = byStart.get(session.startedAt);
    if (!isObject(kept) || Number(session.activeMs) > Number(kept.activeMs)) {
      byStart.set(session.startedAt, session);
    }
  }
  const sessions = [...byStart.entries()]
    .sort(([a], [b]) => Date.parse(a) - Date.parse(b))
    .map(([, session]) => session);
  return JSON.stringify({ ...theirs, ...ours, sessions: [...unknown, ...sessions].slice(-max) });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function storedKeys(): string[] {
  try {
    return Object.keys(localStorage).filter(isBackedUp);
  } catch {
    return [];
  }
}

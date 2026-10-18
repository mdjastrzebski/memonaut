import { z } from 'zod';

/**
 * A backup of everything Memonaut keeps in localStorage, to move progress to another device or
 * keep it safe: a JSON file holding each stored value as it is, keyed by its storage key:
 *
 * ```json
 * { "app": "memonaut", "version": 1, "exportedAt": "2026-10-18T…", "data": { "memonaut:progress:german": "{…}" } }
 * ```
 *
 * The ElevenLabs key stays out, as it's a secret, and so does the theme, as it belongs to the
 * device. Restoring replaces all other stored values with the backup's.
 */
const VERSION = 1;
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
 * Replaces the stored values with a backup's. Returns false, changing nothing, when the text isn't
 * a backup this version can read or storage can't be written.
 */
export function restoreBackup(text: string): boolean {
  let backup: z.infer<typeof backupSchema>;
  try {
    const parsed = backupSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return false;
    backup = parsed.data;
  } catch {
    return false;
  }
  const entries = Object.entries(backup.data).filter(([key]) => isBackedUp(key));

  let previous: [string, string][] = [];
  try {
    previous = storedKeys().map((key) => [key, localStorage.getItem(key) ?? '']);
    for (const [key] of previous) localStorage.removeItem(key);
    for (const [key, value] of entries) localStorage.setItem(key, value);
    return true;
  } catch {
    // Storage is full or blocked; what was there before is put back, as far as it goes.
    try {
      for (const [key] of entries) localStorage.removeItem(key);
      for (const [key, value] of previous) localStorage.setItem(key, value);
    } catch {
      // Nothing more can be done.
    }
    return false;
  }
}

function storedKeys(): string[] {
  try {
    return Object.keys(localStorage).filter(isBackedUp);
  } catch {
    return [];
  }
}

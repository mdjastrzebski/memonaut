import { z } from 'zod';

/**
 * The learner's XP, kept in localStorage across Subjects, with a record of each session that
 * earned some, e.g. for the progress screen:
 *
 * ```json
 * { "version": 1, "total": 42.5, "sessions": [{ "startedAt": "2026-10-18T15:00:00.000Z", … }] }
 * ```
 *
 * Every session is kept, as each is only a few fields. Saving replaces only the session saved and
 * keeps the others as stored, including fields this version doesn't know about. Data from a newer
 * version is read but never overwritten.
 */
const STORAGE_KEY = 'memonaut:xp';
const VERSION = 1;

const sessionSchema = z.object({
  /** ISO time, which tells the session apart. */
  startedAt: z.string(),
  subjectId: z.string(),
  deckId: z.string(),
  /** Time spent practising, without the idle stretches. */
  activeMs: z.number(),
  xp: z.number(),
});

export type SessionXp = z.infer<typeof sessionSchema>;

export interface Xp {
  total: number;
  /** Oldest first. */
  sessions: SessionXp[];
}

/** XP earned so far, and the sessions that earned it. */
export function loadXp(): Xp {
  const stored = read();
  return { total: stored.total, sessions: parseSessions(stored.sessions) };
}

/**
 * Saves a session's XP, replacing what was saved for it before, e.g. after each answer, so a
 * session left early still counts. Returns the XP with it.
 */
export function saveSessionXp(session: SessionXp): Xp {
  const stored = read();
  const index = stored.sessions.findIndex(
    (entry) => parseSession(entry)?.startedAt === session.startedAt,
  );
  const saved = index >= 0 ? parseSession(stored.sessions[index]) : undefined;
  // Fields of a newer version are kept.
  const entry = { ...(stored.sessions[index] as object | undefined), ...session };
  const sessions = saved ? stored.sessions.with(index, entry) : [...stored.sessions, entry];
  const total = stored.total + session.xp - (saved?.xp ?? 0);
  if (stored.version <= VERSION) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...stored.raw, version: VERSION, total, sessions }),
      );
    } catch {
      // Storage can be full or blocked, e.g. in private mode; the XP is then only kept until reload.
    }
  }
  return { total, sessions: parseSessions(sessions) };
}

function read(): {
  raw: Record<string, unknown>;
  version: number;
  total: number;
  sessions: unknown[];
} {
  let raw: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      raw = value as Record<string, unknown>;
    }
  } catch {
    // Unreadable XP starts over from nothing.
  }
  const sessions = Array.isArray(raw.sessions) ? (raw.sessions as unknown[]) : [];
  const total =
    typeof raw.total === 'number'
      ? raw.total
      : parseSessions(sessions).reduce((sum, session) => sum + session.xp, 0);
  return { raw, version: typeof raw.version === 'number' ? raw.version : VERSION, total, sessions };
}

/** Each session is read on its own, so a broken one doesn't hide the rest. */
function parseSessions(sessions: unknown[]): SessionXp[] {
  return sessions.flatMap((entry) => parseSession(entry) ?? []);
}

function parseSession(entry: unknown): SessionXp | undefined {
  return sessionSchema.safeParse(entry).data;
}

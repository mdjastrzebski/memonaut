import { z } from 'zod';

/**
 * Every session with an answer, kept in localStorage, e.g. for the progress screen:
 *
 * ```json
 * { "version": 1, "sessions": [{ "startedAt": "2026-10-18T15:00:00.000Z", "subjectId": "german", … }] }
 * ```
 *
 * Unlike the effort log, which keeps the answers of the latest sessions to tune the effort points,
 * it keeps every session, as each is only a few fields; the total XP is their sum. Saving replaces
 * only the session saved and keeps the others as stored, including fields this version doesn't
 * know about. Data from a newer version is read but never overwritten.
 */
const STORAGE_KEY = 'memonaut:sessions';
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

export type SessionRecord = z.infer<typeof sessionSchema>;

/** Sessions saved so far, oldest first. */
export function loadSessions(): SessionRecord[] {
  return parseSessions(read().sessions);
}

/**
 * Saves a session, replacing what was saved for it before, e.g. after each answer, so a session left
 * early still counts. Returns the sessions with it.
 */
export function saveSession(session: SessionRecord): SessionRecord[] {
  const stored = read();
  const index = stored.sessions.findIndex(
    (entry) => parseSession(entry)?.startedAt === session.startedAt,
  );
  // Fields of a newer version are kept.
  const entry = { ...(stored.sessions[index] as object | undefined), ...session };
  const sessions = index >= 0 ? stored.sessions.with(index, entry) : [...stored.sessions, entry];
  if (stored.version <= VERSION) {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...stored.raw, version: VERSION, sessions }),
      );
    } catch {
      // Storage can be full or blocked, e.g. in private mode; the session is then only kept until reload.
    }
  }
  return parseSessions(sessions);
}

/** XP earned in all the given sessions. */
export function getTotalXp(sessions: SessionRecord[]): number {
  return sessions.reduce((total, session) => total + session.xp, 0);
}

function read(): { raw: Record<string, unknown>; version: number; sessions: unknown[] } {
  let raw: Record<string, unknown> = {};
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      raw = value as Record<string, unknown>;
    }
  } catch {
    // Unreadable sessions start over from none.
  }
  return {
    raw,
    version: typeof raw.version === 'number' ? raw.version : VERSION,
    sessions: Array.isArray(raw.sessions) ? (raw.sessions as unknown[]) : [],
  };
}

/** Each session is read on its own, so a broken one doesn't hide the rest. */
function parseSessions(sessions: unknown[]): SessionRecord[] {
  return sessions.flatMap((entry) => parseSession(entry) ?? []);
}

function parseSession(entry: unknown): SessionRecord | undefined {
  return sessionSchema.safeParse(entry).data;
}

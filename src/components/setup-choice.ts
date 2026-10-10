import type { Content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Deck } from '@/domain/types';

/** How many words a session practises at most; null means every word in the set. */
export type SessionSize = number | null;

export const SESSION_SIZES: SessionSize[] = [5, 10, 20, null];
const DEFAULT_SESSION_SIZE: SessionSize = 10;

const STORAGE_KEY = 'memonaut:setup';

/** What was picked on the setup screen; the Deck's Subject is the picked Subject. */
export interface SetupChoice {
  deck: Deck;
  sessionSize: SessionSize;
}

/**
 * The choice saved by the last visit. Anything missing or no longer offered falls back to the
 * default: the Subject's first Deck, or else the first Subject's.
 */
export function loadSetupChoice(content: Content): SetupChoice {
  const saved = read();
  const deck =
    content.decks.find((deck) => deck.id === saved.deckId) ??
    getSubjectDecks(content.decks, String(saved.subjectId))[0] ??
    getSubjectDecks(content.decks, content.subjects[0].id)[0];
  const sessionSize = SESSION_SIZES.find((size) => size === saved.sessionSize);
  return { deck, sessionSize: sessionSize === undefined ? DEFAULT_SESSION_SIZE : sessionSize };
}

export function saveSetupChoice({ deck, sessionSize }: SetupChoice) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ subjectId: deck.subjectId, deckId: deck.id, sessionSize }),
    );
  } catch {
    // Storage can be full or blocked, e.g. in private mode; the choice is then only kept until reload.
  }
}

function read(): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

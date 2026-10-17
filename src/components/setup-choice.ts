import type { Content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Deck } from '@/domain/types';

/**
 * About how long a session takes, in minutes. It's planned in effort points at the learner's pace,
 * so it holds fewer typed exercises than multiple choice ones.
 */
export const SESSION_MINUTES = [5, 10, 15, 20];
const DEFAULT_SESSION_MINUTES = 10;

const STORAGE_KEY = 'memonaut:setup';

/** What was picked on the setup screen; the Deck's Subject is the picked Subject. */
export interface SetupChoice {
  deck: Deck;
  sessionMinutes: number;
  /** The unit last picked in each Subject, as Deck ids keyed by Subject id. */
  lastUnitIds: Record<string, string>;
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
  const sessionMinutes = SESSION_MINUTES.find((minutes) => minutes === saved.sessionMinutes);
  const savedUnitIds =
    typeof saved.lastUnitIds === 'object' && saved.lastUnitIds !== null ? saved.lastUnitIds : {};
  // Only units still offered in their Subject are kept.
  const lastUnitIds = Object.fromEntries(
    Object.entries(savedUnitIds).filter(([subjectId, deckId]) =>
      content.decks.some(
        (deck) => deck.id === deckId && deck.subjectId === subjectId && deck.kind === 'unit',
      ),
    ),
  );
  return {
    deck,
    sessionMinutes: sessionMinutes ?? DEFAULT_SESSION_MINUTES,
    lastUnitIds,
  };
}

export function saveSetupChoice({ deck, sessionMinutes, lastUnitIds }: SetupChoice) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ subjectId: deck.subjectId, deckId: deck.id, sessionMinutes, lastUnitIds }),
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

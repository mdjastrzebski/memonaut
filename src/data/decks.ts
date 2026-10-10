import type { Deck } from '@/domain/types';

/** A Subject's Decks in the order to offer them: core Decks first, then units in file order. */
export function getSubjectDecks(decks: Deck[], subjectId: string): Deck[] {
  const own = decks.filter((deck) => deck.subjectId === subjectId);
  return [
    ...own.filter((deck) => deck.kind === 'core'),
    ...own.filter((deck) => deck.kind !== 'core'),
  ];
}

export interface DeckOverlap {
  deck: Deck;
  /** Concepts that are in both Decks. */
  count: number;
}

export interface DeckStats {
  conceptCount: number;
  /** Other Decks of the same Subject that share Concepts with this one, core Decks first. */
  overlaps: DeckOverlap[];
  /** Concepts in no other Deck. */
  exclusiveCount: number;
}

/** How big a Deck is and how much it shares with the other Decks of its Subject. */
export function getDeckStats(deck: Deck, decks: Deck[]): DeckStats {
  const conceptIds = new Set(deck.conceptIds);
  const others = getSubjectDecks(decks, deck.subjectId).filter((other) => other.id !== deck.id);

  const overlaps = others
    .map((other) => ({
      deck: other,
      count: other.conceptIds.filter((id) => conceptIds.has(id)).length,
    }))
    .filter((overlap) => overlap.count > 0);

  const shared = new Set(others.flatMap((other) => other.conceptIds));
  return {
    conceptCount: conceptIds.size,
    overlaps,
    exclusiveCount: deck.conceptIds.filter((id) => !shared.has(id)).length,
  };
}

import type { Deck } from '@/domain/types';

/** A Subject's Decks in the order to offer them: core Decks first, then units in file order. */
export function getSubjectDecks(decks: Deck[], subjectId: string): Deck[] {
  const own = decks.filter((deck) => deck.subjectId === subjectId);
  return [
    ...own.filter((deck) => deck.kind === 'core'),
    ...own.filter((deck) => deck.kind !== 'core'),
  ];
}

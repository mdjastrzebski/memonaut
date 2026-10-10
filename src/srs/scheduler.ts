import {
  createEmptyCard,
  fsrs,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs';

export { Rating, State, type FsrsCard, type Grade };

export const GRADES = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const;

// Default FSRS parameters: 90% target retention, learning steps 1m → 10m, relearning step 10m.
// Fuzz is off so intervals are deterministic and easier to reason about.
const scheduler = fsrs({ enable_fuzz: false });

export function createSrsCard(now: Date): FsrsCard {
  return createEmptyCard(now);
}

/** What each grade would do to the card if it were reviewed at `now`. */
export function previewReview(card: FsrsCard, now: Date): Record<Grade, RecordLogItem> {
  const preview = scheduler.repeat(card, now);
  return {
    [Rating.Again]: preview[Rating.Again],
    [Rating.Hard]: preview[Rating.Hard],
    [Rating.Good]: preview[Rating.Good],
    [Rating.Easy]: preview[Rating.Easy],
  };
}

export function reviewSrsCard(card: FsrsCard, grade: Grade, now: Date): RecordLogItem {
  return scheduler.next(card, now, grade);
}

/** Probability (0–1) that the learner recalls the card at `now`. Returns 0 for new cards. */
export function getRetrievability(card: FsrsCard, now: Date): number {
  return scheduler.get_retrievability(card, now, false);
}

export function ratingName(grade: Rating): string {
  return Rating[grade];
}

export function stateName(state: State): string {
  return State[state];
}

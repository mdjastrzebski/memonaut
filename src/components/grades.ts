import { Check, RotateCcw, Target, Zap, type LucideIcon } from 'lucide-react';

import { Rating, State, type Grade } from '@/srs/scheduler';

/** The icon shown with each rating in an exercise's feedback. */
export const GRADE_ICONS: Record<Grade, LucideIcon> = {
  [Rating.Again]: RotateCcw,
  [Rating.Hard]: Target,
  [Rating.Good]: Check,
  [Rating.Easy]: Zap,
};

/** How each rating looks to the learner. */
export const GRADE_STYLES: Record<
  Grade,
  { mark: string; text: string; fill: string; tint: string; border: string }
> = {
  [Rating.Again]: {
    mark: '✗',
    text: 'text-wrong-ink',
    fill: 'bg-wrong',
    tint: 'bg-wrong/15',
    border: 'border-wrong',
  },
  [Rating.Hard]: {
    mark: '≈',
    text: 'text-almost-ink',
    fill: 'bg-almost',
    tint: 'bg-almost/25',
    border: 'border-almost',
  },
  [Rating.Good]: {
    mark: '✓',
    text: 'text-correct-ink',
    fill: 'bg-correct',
    tint: 'bg-correct/20',
    border: 'border-correct',
  },
  [Rating.Easy]: {
    mark: '✓',
    text: 'text-correct-ink',
    fill: 'bg-fast',
    tint: 'bg-correct/20',
    border: 'border-correct',
  },
};

export type Progress = 'new' | 'learning' | 'learned';

/** The learner-facing view of an FSRS state. */
export function getProgress(state: State): Progress {
  if (state === State.New) return 'new';
  return state === State.Review ? 'learned' : 'learning';
}

/** A word is learned once all its Cards are, and new until any of them is practised. */
export function getWordProgress(states: State[]): Progress {
  const progress = states.map(getProgress);
  if (progress.every((value) => value === 'learned')) return 'learned';
  return progress.every((value) => value === 'new') ? 'new' : 'learning';
}

/** Learner-facing names for each Progress, shared by every screen. */
export const PROGRESS_LABELS: Record<Progress, string> = {
  learned: 'Learned',
  learning: 'Learning',
  new: 'New',
};

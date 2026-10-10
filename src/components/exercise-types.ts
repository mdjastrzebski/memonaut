import { Languages, Volume2, type LucideIcon } from 'lucide-react';

import type { ExerciseType } from '@/domain/types';

/** How each Exercise Type is named and drawn for the learner. */
export const EXERCISES: Record<ExerciseType, { label: string; Icon: LucideIcon }> = {
  dictation: { label: 'Dictation', Icon: Volume2 },
  translation: { label: 'Translation', Icon: Languages },
};

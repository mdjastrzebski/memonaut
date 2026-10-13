import { CircleHelp, Eye, Languages, ListChecks, Volume2, type LucideIcon } from 'lucide-react';

import type { ExerciseType } from '@/domain/types';

/** How each Exercise Type is named and drawn for the learner. */
export const EXERCISES: Record<ExerciseType, { label: string; Icon: LucideIcon }> = {
  'recognition-choice': { label: 'Recognition', Icon: Eye },
  'dictation': { label: 'Dictation', Icon: Volume2 },
  'translation-choice': { label: 'Translation choice', Icon: ListChecks },
  'translation': { label: 'Translation', Icon: Languages },
  'question': { label: 'Question', Icon: CircleHelp },
};

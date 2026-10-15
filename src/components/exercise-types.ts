import {
  CircleHelp,
  Eye,
  Languages,
  ListChecks,
  SquareCheckBig,
  Tag,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

import type { ExerciseType } from '@/domain/types';

/** How each Exercise Type is named and drawn for the learner. */
export const EXERCISES: Record<ExerciseType, { label: string; Icon: LucideIcon }> = {
  'recognition-choice': { label: 'Recognition', Icon: Eye },
  'dictation': { label: 'Dictation', Icon: Volume2 },
  'translation-choice': { label: 'Translation choice', Icon: ListChecks },
  'article-choice-de': { label: 'Article', Icon: Tag },
  'translation': { label: 'Translation', Icon: Languages },
  'question-choice': { label: 'Question choice', Icon: SquareCheckBig },
  'question-type': { label: 'Question', Icon: CircleHelp },
};

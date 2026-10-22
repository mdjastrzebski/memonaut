import {
  CircleHelp,
  Brackets,
  Copy,
  Eye,
  Languages,
  Layers,
  ListChecks,
  SquareCheckBig,
  Tag,
  Volume2,
  type LucideIcon,
} from 'lucide-react';

import type { ExerciseType } from '@/domain/types';

/** How each Exercise Type is named and drawn for the learner; `short` where space is tight. */
export const EXERCISES: Record<ExerciseType, { label: string; short: string; Icon: LucideIcon }> = {
  'recognition-choice': { label: 'Recognition', short: 'Recog.', Icon: Eye },
  'dictation': { label: 'Dictation', short: 'Dict.', Icon: Volume2 },
  'translation-choice': { label: 'Translation choice', short: 'Tr. choice', Icon: ListChecks },
  'article-choice-de': { label: 'Article', short: 'Art.', Icon: Tag },
  'cloze': { label: 'Cloze', short: 'Cloze', Icon: Brackets },
  'translation': { label: 'Translation', short: 'Transl.', Icon: Languages },
  'plural-form': { label: 'Plural', short: 'Pl.', Icon: Copy },
  'translation-plural': { label: 'Translation plural', short: 'Tr. pl.', Icon: Layers },
  'question-choice': { label: 'Question choice', short: 'Q. choice', Icon: SquareCheckBig },
  'question-type': { label: 'Question', short: 'Q.', Icon: CircleHelp },
};

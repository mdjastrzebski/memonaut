import type { ComponentType } from 'react';

import { ArticleChoiceDeExercise } from '@/components/exercises/article-choice-de-exercise';
import { DictationExercise } from '@/components/exercises/dictation-exercise';
import type { ExerciseProps } from '@/components/exercises/exercise-parts';
import {
  PluralFormExercise,
  TranslationPluralExercise,
} from '@/components/exercises/plural-exercises';
import { QuestionChoiceExercise } from '@/components/exercises/question-choice-exercise';
import { QuestionTypeExercise } from '@/components/exercises/question-type-exercise';
import { RecognitionChoiceExercise } from '@/components/exercises/recognition-choice-exercise';
import { TranslationChoiceExercise } from '@/components/exercises/translation-choice-exercise';
import { TranslationExercise } from '@/components/exercises/translation-exercise';
import type { ExerciseType } from '@/domain/types';
import { getCurrentCard } from '@/session/session';

export type ExerciseScreenProps = Omit<ExerciseProps, 'card' | 'concept'>;

/** The component drawing each Exercise Type. */
const EXERCISE_COMPONENTS: Record<ExerciseType, ComponentType<ExerciseProps>> = {
  'recognition-choice': RecognitionChoiceExercise,
  'dictation': DictationExercise,
  'translation-choice': TranslationChoiceExercise,
  'article-choice-de': ArticleChoiceDeExercise,
  'translation': TranslationExercise,
  'plural-form': PluralFormExercise,
  'translation-plural': TranslationPluralExercise,
  'question-choice': QuestionChoiceExercise,
  'question-type': QuestionTypeExercise,
};

/** The session's current exercise, drawn by its Exercise Type's component. */
export function ExerciseScreen(props: ExerciseScreenProps) {
  const card = getCurrentCard(props.session);
  const concept = card && props.session.concepts[card.conceptId];
  if (!card || !concept) return null;

  const Exercise = EXERCISE_COMPONENTS[card.exerciseType];
  return <Exercise {...props} card={card} concept={concept} />;
}

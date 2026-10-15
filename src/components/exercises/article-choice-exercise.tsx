import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { WordFeedback } from '@/components/exercises/word-choice-exercise';
import { getArticleNoun } from '@/exercises/article';
import { speak } from '@/lib/speech';

/**
 * Article choice: the learner sees a noun without its article, e.g. "Buch", with its meaning, and
 * picks the article from the Subject's, e.g. der, die or das, always in the same order. The word is
 * read aloud only once they've picked, as hearing it would give the article away.
 */
export function ArticleChoiceExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const articleNoun = getArticleNoun(concept, subject.articles);
  if (!articleNoun || !subject.articles) {
    throw new Error(`${props.card.exerciseType} needs a noun with one of the subject's articles`);
  }
  const { articles } = subject;
  const playWord = () => speak(concept.foreign, subject.foreignLanguage);

  return (
    <ChoiceExercise
      {...props}
      question="Which article?"
      prompt={
        <div className="flex min-w-0 flex-col gap-1">
          <PromptWord>{articleNoun.noun}</PromptWord>
          {concept.local && (
            <p className="text-lg font-semibold break-words text-muted-foreground">
              {concept.local}
            </p>
          )}
        </div>
      }
      answer={articleNoun.article}
      pickOptions={() => articles}
      feedback={<WordFeedback concept={concept} />}
      onListen={playWord}
      onPicked={playWord}
    />
  );
}

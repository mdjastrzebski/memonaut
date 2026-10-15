import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { MarkedText } from '@/components/marked-text';
import type { LanguageConcept } from '@/domain/types';
import {
  GERMAN_ARTICLES,
  getCompoundHint,
  getEndingHint,
  getGermanNoun,
  type GermanArticle,
  type GermanNoun,
} from '@/exercises/german-articles';
import { speak } from '@/lib/speech';

/** Each gender's color, as German is often taught: der blue, die red, das green. */
const ARTICLE_COLORS: Record<GermanArticle, string> = {
  der: 'text-sky-600 dark:text-sky-400',
  die: 'text-rose-600 dark:text-rose-400',
  das: 'text-emerald-600 dark:text-emerald-400',
};

function Article({ article }: { article: string }) {
  return <span className={ARTICLE_COLORS[article as GermanArticle]}>{article}</span>;
}

/**
 * German article choice: the learner sees a noun without its article, e.g. "Buch", with its
 * meaning, and picks der, die or das, each in its gender's color and always in the same order. The
 * word is read aloud only once they've picked, as hearing it would give the article away. The
 * result tells what gives the article away: the word's own explanation or else its ending, e.g.
 * -ung for die, and the noun a compound ends with, e.g. "der Ball" for "der Fußball".
 */
export function ArticleChoiceDeExercise(props: ExerciseProps) {
  const { concept, subject } = getLanguageProps(props);
  const germanNoun = getGermanNoun(concept);
  if (!germanNoun) {
    throw new Error(`${props.card.exerciseType} needs a German noun with its article`);
  }
  const playWord = () => speak(concept.foreign, subject.foreignLanguage);
  const words = props.subjectConcepts.filter(
    (other): other is LanguageConcept => other.kind === 'language' && other.id !== concept.id,
  );

  return (
    <ChoiceExercise
      {...props}
      question="Der, die or das?"
      prompt={
        <div className="flex min-w-0 flex-col gap-1">
          <PromptWord>{germanNoun.noun}</PromptWord>
          {concept.local && (
            <p className="text-lg font-semibold break-words text-muted-foreground">
              {concept.local}
            </p>
          )}
        </div>
      }
      answer={germanNoun.article}
      pickOptions={() => [...GERMAN_ARTICLES]}
      renderOption={(option) => <Article article={option} />}
      feedback={<ArticleFeedback concept={concept} germanNoun={germanNoun} words={words} />}
      onListen={playWord}
      onPicked={playWord}
    />
  );
}

interface ArticleFeedbackProps {
  concept: LanguageConcept;
  germanNoun: GermanNoun;
  /** The Subject's other words, to find the noun a compound ends with. */
  words: LanguageConcept[];
}

function ArticleFeedback({ concept, germanNoun, words }: ArticleFeedbackProps) {
  const hint = concept.explanation ?? getEndingText(germanNoun);
  const compound = getCompoundHint(germanNoun, words);
  const hintClass = 'basis-full text-lg text-muted-foreground';

  return (
    <>
      <span>
        <Article article={germanNoun.article} /> {germanNoun.noun}
      </span>
      <span aria-hidden className="text-muted-foreground">
        =
      </span>
      <span className="sr-only">means</span>
      <span>{concept.local}</span>
      {hint && <MarkedText text={hint} className={hintClass} />}
      {compound && (
        <MarkedText text={`${compound.compound} jak ${compound.base}`} className={hintClass} />
      )}
    </>
  );
}

/** What the noun's ending tells, in the learner's language, e.g. "na -[ung] → zawsze [die]". */
function getEndingText(germanNoun: GermanNoun): string | undefined {
  const hint = getEndingHint(germanNoun);
  if (!hint) return undefined;
  const rule = `na -[${hint.ending}] → ${hint.usually ? 'zwykle' : 'zawsze'} [${hint.article}]`;
  return hint.follows ? rule : `wyjątek: ${rule}`;
}

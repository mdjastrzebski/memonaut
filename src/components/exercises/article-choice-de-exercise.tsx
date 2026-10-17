import { ChoiceExercise } from '@/components/exercises/choice-exercise';
import { PromptWord, type ExerciseProps } from '@/components/exercises/exercise-parts';
import { getLanguageProps } from '@/components/exercises/language-props';
import { MarkedText } from '@/components/marked-text';
import type { LanguageConcept } from '@/domain/types';
import {
  getCompoundHint,
  getDeterminer,
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

/** A word before a noun, e.g. "das" or "meine", in its gender's color if it tells only one. */
function Determiner({ word }: { word: string }) {
  const articles = getDeterminer(word)?.articles;
  return (
    <span className={articles?.length === 1 ? ARTICLE_COLORS[articles[0]] : undefined}>{word}</span>
  );
}

/** The question for the options, e.g. "Der, die or das?". */
function getQuestion(options: string[]): string {
  const question = `${options.slice(0, -1).join(', ')} or ${options.at(-1)}?`;
  return question[0].toUpperCase() + question.slice(1);
}

/**
 * German article choice: the learner sees a noun without its article, e.g. "Buch", with its
 * meaning, and picks der, die or das, each in its gender's color and always in the same order; or,
 * for a noun with another word before it, its form, e.g. dieser, diese or dieses for "dieses Buch",
 * or mein or meine for "meine Tasche". The word is read
 * aloud only once they've picked, as hearing it would give the article away. The result tells what
 * gives the article away: the word's own explanation or else its ending, e.g. -ung for die, and the
 * noun with der, die or das it takes after, e.g. "der Ball" for "der Fußball" or "der Freund" for
 * "mein Freund".
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
      question={getQuestion(germanNoun.options)}
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
      answer={germanNoun.determiner}
      pickOptions={() => germanNoun.options}
      renderOption={(option) => <Determiner word={option} />}
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
        <Determiner word={germanNoun.determiner} /> {germanNoun.noun}
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

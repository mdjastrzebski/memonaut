import { AlarmClock, ArrowDown, ChevronDown, Circle, type LucideIcon } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { CONCEPT_NOUNS, getConceptText } from '@/components/concept-text';
import { EXERCISES } from '@/components/exercise-types';
import { getProgress, PROGRESS_LABELS, type Progress } from '@/components/grades';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Content } from '@/data/content';
import type { Card, Concept, Deck, ExerciseType } from '@/domain/types';
import { formatDuration, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getCardId, getConceptExerciseTypes } from '@/session/session';
import { getRetrievability, State, type FsrsCard } from '@/srs/scheduler';

/** What the table shows about each Card, one column each. */
type CardStat = 'due' | 'difficulty';

/** A difficulty from which a Card counts as hard, shown in red. */
const HARD_DIFFICULTY = 7;

const STATS: Record<
  CardStat,
  {
    label: string;
    /** Sorts a column by it, the most worth a look first, e.g. the hardest Cards. */
    value: (srs: FsrsCard) => number;
    descending: boolean;
    format: (srs: FsrsCard, now: Date) => ReactNode;
    /** Whether a Card's value is worth a look, e.g. overdue, shown in red. */
    warn: (srs: FsrsCard, now: Date) => boolean;
  }
> = {
  due: {
    label: 'Next review',
    value: (srs) => srs.due.getTime(),
    descending: false,
    format: (srs, now) =>
      srs.due <= now ? (
        <Symbol Icon={AlarmClock} label="due" />
      ) : (
        formatDuration(srs.due.getTime() - now.getTime())
      ),
    warn: (srs, now) => srs.due <= now,
  },
  difficulty: {
    label: 'Difficulty',
    value: (srs) => srs.difficulty,
    descending: true,
    format: (srs) => srs.difficulty.toFixed(1),
    warn: (srs) => srs.difficulty >= HARD_DIFFICULTY,
  },
};

const STAT_COLUMNS = Object.keys(STATS) as CardStat[];

const PROGRESS_TINTS: Record<Progress, string> = {
  learned: 'bg-correct/20',
  learning: 'bg-almost/25',
  new: '',
};

interface ConceptTableProps {
  content: Content;
  deck: Deck;
  cards: Record<string, Card>;
  /** The Deck's Exercise Types with Cards, a column of each stat each. */
  exerciseTypes: ExerciseType[];
  now: Date;
}

/**
 * A Deck's words as a table that opens on demand: one row per word, and for each Exercise Type its
 * Card's next review and difficulty. A column sorts the words by it.
 */
export function ConceptTable({ content, deck, cards, exerciseTypes, now }: ConceptTableProps) {
  const [open, setOpen] = useState(false);
  const [sortBy, setSortBy] = useState<{ exerciseType: ExerciseType; stat: CardStat }>();
  const tableId = useId();
  const subject = content.subjects.find((subject) => subject.id === deck.subjectId);
  const noun = CONCEPT_NOUNS[subject?.kind ?? 'language'];
  const concepts = deck.conceptIds
    .map((id) => content.concepts.find((concept) => concept.id === id))
    .filter((concept) => !!concept);
  const getCard = (concept: Concept, exerciseType: ExerciseType) =>
    getConceptExerciseTypes(deck, concept.id).includes(exerciseType)
      ? (cards[getCardId(concept.id, exerciseType)]?.srs ?? null)
      : undefined;
  const sortColumn = sortBy && exerciseTypes.includes(sortBy.exerciseType) ? sortBy : undefined;
  const rows = sortColumn
    ? sortConcepts(concepts, (c) => getCard(c, sortColumn.exerciseType), sortColumn.stat)
    : concepts;

  return (
    <div className="flex flex-col gap-3">
      <h4 className="font-display font-bold">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen(!open)}
          className="flex cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {noun.Many} by exercise
          <ChevronDown
            aria-hidden
            className={cn('size-4 transition-transform', open && 'rotate-180')}
          />
        </button>
      </h4>
      {open && (
        <div
          id={tableId}
          className="max-h-[32rem] overflow-auto rounded-2xl border-2 border-foreground/15 bg-background"
        >
          <table aria-label={`${noun.Many} in ${deck.name}`} className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="border-b-0 hover:bg-transparent">
                <TableHead rowSpan={2} className="sticky left-0 z-10 bg-background">
                  <button
                    type="button"
                    onClick={() => setSortBy(undefined)}
                    aria-label={`${noun.Many} in set order`}
                    className="cursor-pointer rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {noun.one[0].toUpperCase() + noun.one.slice(1)}
                  </button>
                </TableHead>
                {exerciseTypes.map((exerciseType) => {
                  const { label, Icon } = EXERCISES[exerciseType];
                  return (
                    <TableHead
                      key={exerciseType}
                      colSpan={STAT_COLUMNS.length}
                      className="h-8 border-l border-foreground/10 text-center"
                    >
                      <span className="flex items-center justify-center gap-1">
                        <Icon aria-hidden className="size-3.5 shrink-0" />
                        {label}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
              <TableRow className="hover:bg-transparent">
                {exerciseTypes.flatMap((exerciseType) =>
                  STAT_COLUMNS.map((stat, index) => {
                    const sorted =
                      sortColumn?.exerciseType === exerciseType && sortColumn.stat === stat;
                    const { label, descending } = STATS[stat];
                    return (
                      <TableHead
                        key={`${exerciseType}:${stat}`}
                        aria-sort={sorted ? (descending ? 'descending' : 'ascending') : undefined}
                        className={cn(
                          'h-8 text-center text-xs',
                          index === 0 && 'border-l border-foreground/10',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSortBy(sorted ? undefined : { exerciseType, stat })}
                          aria-label={`${EXERCISES[exerciseType].label}: ${label}`}
                          title={`Sort by ${label.toLowerCase()} in ${EXERCISES[exerciseType].label.toLowerCase()}`}
                          className={cn(
                            'mx-auto flex cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                            !sorted && 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {label}
                          {sorted && <ArrowDown aria-hidden className="size-3 shrink-0" />}
                        </button>
                      </TableHead>
                    );
                  }),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((concept) => {
                // A word first, then its meaning; a question first, then its answer.
                const { prompt, answer } = getConceptText(concept);
                const [main, extra] =
                  concept.kind === 'knowledge' ? [prompt, answer] : [answer, prompt];
                return (
                  <TableRow key={concept.id} className="border-foreground/10">
                    <TableCell className="sticky left-0 max-w-48 bg-background whitespace-normal">
                      <span className="block font-semibold break-words">{main}</span>
                      {extra && (
                        <span className="block text-xs break-words text-muted-foreground">
                          {extra}
                        </span>
                      )}
                    </TableCell>
                    {exerciseTypes.flatMap((exerciseType) =>
                      STAT_COLUMNS.map((stat, index) => (
                        <StatCell
                          key={`${exerciseType}:${stat}`}
                          exerciseType={exerciseType}
                          srs={getCard(concept, exerciseType)}
                          stat={stat}
                          now={now}
                          className={cn(index === 0 && 'border-l border-foreground/10')}
                        />
                      )),
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * One Card's stat, tinted by how well it's known; hovering it tells the rest. Empty for an Exercise
 * Type the word isn't practised with; a circle in the first column for one not practised yet.
 */
function StatCell({
  exerciseType,
  srs,
  stat,
  now,
  className,
}: {
  exerciseType: ExerciseType;
  /** The Card's review state, null if never practised, undefined if it has no such Card. */
  srs: FsrsCard | null | undefined;
  stat: CardStat;
  now: Date;
  className?: string;
}) {
  if (srs === undefined) {
    return <TableCell aria-label="Not practised with this exercise" className={className} />;
  }
  const label = EXERCISES[exerciseType].label;
  if (!srs || srs.state === State.New) {
    return (
      <TableCell
        title={`${label}: not practised yet`}
        className={cn('text-center text-muted-foreground', className)}
      >
        {stat === STAT_COLUMNS[0] && (
          <Symbol Icon={Circle} label="new" className="size-3 opacity-50" />
        )}
      </TableCell>
    );
  }
  const progress = getProgress(srs.state);
  const { format, warn } = STATS[stat];
  return (
    <TableCell
      title={describeCard(label, srs, now)}
      className={cn(
        'text-center tabular-nums',
        PROGRESS_TINTS[progress],
        warn(srs, now) && 'font-bold text-wrong-ink',
        className,
      )}
    >
      {format(srs, now)}
    </TableCell>
  );
}

/** Everything about a Card in one line, e.g. "Translation: Learned · next review in 3d · …". */
function describeCard(label: string, srs: FsrsCard, now: Date): string {
  return [
    `${label}: ${PROGRESS_LABELS[getProgress(srs.state)]}`,
    srs.due <= now
      ? 'due now'
      : `next review in ${formatDuration(srs.due.getTime() - now.getTime())}`,
    `recall ${formatPercent(getRetrievability(srs, now))}`,
    `difficulty ${srs.difficulty.toFixed(1)}`,
    `${srs.reps} ${srs.reps === 1 ? 'review' : 'reviews'}`,
    `forgotten ${srs.lapses}×`,
  ].join(' · ');
}

/**
 * Concepts sorted by a stat of their Card of one Exercise Type, the most worth a look first; those
 * without a practised Card last, in Deck order.
 */
function sortConcepts<T>(
  concepts: T[],
  getSrs: (concept: T) => FsrsCard | null | undefined,
  stat: CardStat,
): T[] {
  const { value, descending } = STATS[stat];
  const keyed = concepts.map((concept) => {
    const srs = getSrs(concept);
    return { concept, key: srs && srs.state !== State.New ? value(srs) : undefined };
  });
  const practised = keyed.filter(({ key }) => key !== undefined);
  const rest = keyed.filter(({ key }) => key === undefined);
  practised.sort((a, b) => (descending ? b.key! - a.key! : a.key! - b.key!));
  return [...practised, ...rest].map(({ concept }) => concept);
}

/** A symbol in place of a word, which screen readers still read. */
function Symbol({
  Icon,
  label,
  className,
}: {
  Icon: LucideIcon;
  label: string;
  className?: string;
}) {
  return (
    <>
      <Icon aria-hidden className={cn('mx-auto size-4', className)} />
      <span className="sr-only">{label}</span>
    </>
  );
}

import {
  AlarmClock,
  ArrowDown,
  Brain,
  CalendarClock,
  ChevronDown,
  Circle,
  Gauge,
  Repeat,
  RotateCcw,
  type LucideIcon,
} from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { CONCEPT_NOUNS, getConceptText } from '@/components/concept-text';
import { EXERCISES } from '@/components/exercise-types';
import { getProgress, PROGRESS_LABELS, type Progress } from '@/components/grades';
import { SegmentedToggle } from '@/components/segmented-toggle';
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Content } from '@/data/content';
import type { Card, Concept, Deck, ExerciseType } from '@/domain/types';
import { formatDuration, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getCardId, getConceptExerciseTypes } from '@/session/session';
import { getRetrievability, State, type FsrsCard } from '@/srs/scheduler';

/** What each cell of the table shows about its Card. */
export type CardStat = 'due' | 'recall' | 'difficulty' | 'reviews' | 'lapses';

/** A difficulty from which a Card counts as hard, shown in red. */
const HARD_DIFFICULTY = 7;

const STATS: Record<
  CardStat,
  {
    label: string;
    Icon: LucideIcon;
    /** Sorts a column by it, the most worth a look first, e.g. the hardest Cards. */
    value: (srs: FsrsCard, now: Date) => number;
    descending: boolean;
    format: (srs: FsrsCard, now: Date) => ReactNode;
    /** Whether a Card's value is worth a look, e.g. overdue, shown in red. */
    warn: (srs: FsrsCard, now: Date) => boolean;
  }
> = {
  due: {
    label: 'Next review',
    Icon: CalendarClock,
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
  recall: {
    label: 'Recall',
    Icon: Brain,
    value: (srs, now) => getRetrievability(srs, now),
    descending: false,
    format: (srs, now) => formatPercent(getRetrievability(srs, now)),
    warn: (srs, now) => getRetrievability(srs, now) < 0.8,
  },
  difficulty: {
    label: 'Difficulty',
    Icon: Gauge,
    value: (srs) => srs.difficulty,
    descending: true,
    format: (srs) => srs.difficulty.toFixed(1),
    warn: (srs) => srs.difficulty >= HARD_DIFFICULTY,
  },
  reviews: {
    label: 'Reviews',
    Icon: Repeat,
    value: (srs) => srs.reps,
    descending: true,
    format: (srs) => String(srs.reps),
    warn: () => false,
  },
  lapses: {
    label: 'Forgotten',
    Icon: RotateCcw,
    value: (srs) => srs.lapses,
    descending: true,
    format: (srs) => String(srs.lapses),
    warn: (srs) => srs.lapses > 0,
  },
};

const STAT_OPTIONS = Object.entries(STATS).map(
  ([stat, { label, Icon }]) => [stat, label, Icon] as [CardStat, string, LucideIcon],
);

const PROGRESS_TINTS: Record<Progress, string> = {
  learned: 'bg-correct/20',
  learning: 'bg-almost/25',
  new: '',
};

interface ConceptTableProps {
  content: Content;
  deck: Deck;
  cards: Record<string, Card>;
  /** The Deck's Exercise Types with Cards, one column each. */
  exerciseTypes: ExerciseType[];
  now: Date;
}

/**
 * A Deck's words as a table that opens on demand: one row per word, one column per Exercise Type,
 * each cell showing its Card's next review, recall, difficulty, reviews or lapses. A column sorts
 * the words by it.
 */
export function ConceptTable({ content, deck, cards, exerciseTypes, now }: ConceptTableProps) {
  const [open, setOpen] = useState(false);
  const [stat, setStat] = useState<CardStat>('due');
  const [sortBy, setSortBy] = useState<ExerciseType>();
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
  const sortColumn = sortBy && exerciseTypes.includes(sortBy) ? sortBy : undefined;
  const rows = sortColumn
    ? sortConcepts(concepts, (c) => getCard(c, sortColumn), stat, now)
    : concepts;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
          <SegmentedToggle label="Show" options={STAT_OPTIONS} value={stat} onChange={setStat} />
        )}
      </div>
      {open && (
        <div
          id={tableId}
          className="max-h-[32rem] overflow-auto rounded-2xl border-2 border-foreground/15 bg-background"
        >
          <table aria-label={`${noun.Many} in ${deck.name}`} className="w-full text-sm">
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 bg-background">
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
                  const sorted = sortColumn === exerciseType;
                  return (
                    <TableHead
                      key={exerciseType}
                      aria-sort={
                        sorted ? (STATS[stat].descending ? 'descending' : 'ascending') : undefined
                      }
                      className="text-center"
                    >
                      <button
                        type="button"
                        onClick={() => setSortBy(sorted ? undefined : exerciseType)}
                        title={`Sort by ${STATS[stat].label.toLowerCase()} in ${label.toLowerCase()}`}
                        className={cn(
                          'mx-auto flex cursor-pointer items-center gap-1 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                          !sorted && 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Icon aria-hidden className="size-3.5 shrink-0" />
                        {label}
                        {sorted && <ArrowDown aria-hidden className="size-3.5 shrink-0" />}
                      </button>
                    </TableHead>
                  );
                })}
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
                    {exerciseTypes.map((exerciseType) => (
                      <StatCell
                        key={exerciseType}
                        exerciseType={exerciseType}
                        srs={getCard(concept, exerciseType)}
                        stat={stat}
                        now={now}
                      />
                    ))}
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
 * Type the word isn't practised with, a dash for one not practised yet.
 */
function StatCell({
  exerciseType,
  srs,
  stat,
  now,
}: {
  exerciseType: ExerciseType;
  /** The Card's review state, null if never practised, undefined if it has no such Card. */
  srs: FsrsCard | null | undefined;
  stat: CardStat;
  now: Date;
}) {
  if (srs === undefined) return <TableCell aria-label="Not practised with this exercise" />;
  const label = EXERCISES[exerciseType].label;
  if (!srs || srs.state === State.New) {
    return (
      <TableCell
        title={`${label}: not practised yet`}
        className="text-center text-muted-foreground"
      >
        <Symbol Icon={Circle} label="new" className="size-3 opacity-50" />
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
  now: Date,
): T[] {
  const { value, descending } = STATS[stat];
  const keyed = concepts.map((concept) => {
    const srs = getSrs(concept);
    return { concept, key: srs && srs.state !== State.New ? value(srs, now) : undefined };
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

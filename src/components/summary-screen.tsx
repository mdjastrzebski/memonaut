import { Rocket } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { CONCEPT_NOUNS, getConceptText } from '@/components/concept-text';
import { EXERCISES } from '@/components/exercise-types';
import { getProgress, GRADE_STYLES, PROGRESS_LABELS, type Progress } from '@/components/grades';
import { AdvancedPanel, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Card, Review, SubjectKind } from '@/domain/types';
import { formatDuration, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { playCompleted } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { getEffortDone, type Session } from '@/session/session';
import { GRADES, Rating, State, type Grade } from '@/srs/scheduler';

/** Learner-facing names for the ratings. */
const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Easy]: 'Fast',
  [Rating.Good]: 'Correct',
  [Rating.Hard]: 'Almost',
  [Rating.Again]: 'Missed',
};

const PROGRESS_STYLES: Record<Progress, string> = {
  learning: 'border-almost bg-almost/25 text-almost-ink',
  learned: 'border-correct bg-correct/20 text-correct-ink',
  new: 'border-transparent bg-muted text-muted-foreground',
};

interface SummaryScreenProps {
  session: Session;
  /** Its kind names the Concepts, e.g. "words". */
  subjectKind: SubjectKind;
  /** Time spent practising, without the idle stretches. */
  activeMs: number;
  /** How long the session was expected to take, at the learner's pace when it started. */
  plannedMinutes: number;
  /** Goes back to the setup screen to choose the next session. */
  onNewSession: () => void;
}

export function SummaryScreen({
  session,
  subjectKind,
  activeMs,
  plannedMinutes,
  onNewSession,
}: SummaryScreenProps) {
  const [now] = useState(() => new Date());
  const [showAdvanced, setShowAdvanced] = useState(false);

  // The ref keeps StrictMode's second effect run from playing it twice.
  const played = useRef(false);
  useEffect(() => {
    if (!played.current) {
      played.current = true;
      playCompleted();
    }
  }, []);
  const cards = Object.values(session.cards);
  const { reviews } = session;
  const correctCount = reviews.filter((review) => review.rating !== Rating.Again).length;
  const accuracy = reviews.length ? correctCount / reviews.length : 0;
  const { newWords, repeatedWords } = countNewAndRepeatedWords(session);
  const noun = CONCEPT_NOUNS[subjectKind];

  const stats: [label: string, value: string, note?: string][] = [
    ['Time', formatDuration(activeMs), `planned ${formatDuration(plannedMinutes * 60_000)}`],
    ['Effort points', String(Math.round(getEffortDone(session)))],
    [`Repeated ${noun.many}`, String(repeatedWords)],
    [`New ${noun.many}`, String(newWords)],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative flex animate-card-in flex-col items-center gap-6 overflow-hidden rounded-[2rem] border-2 border-line bg-card p-6 shadow-sticker-lg sm:flex-row sm:p-10">
        <AccuracyRing value={accuracy} empty={reviews.length === 0} />

        <div className="flex flex-1 flex-col gap-3 text-center sm:text-left">
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Session results · {session.deck.name}
          </p>
          <h2 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            {getHeadline(reviews.length, accuracy)}
          </h2>
          {reviews.length > 0 && <RatingBar reviews={reviews} />}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value, note], index) => (
          <div
            key={label}
            className="animate-rise rounded-2xl border-2 border-line bg-card p-4 shadow-sticker-sm"
            style={{ animationDelay: `${150 + index * 60}ms` }}
          >
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
            {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="font-display text-2xl font-bold">{noun.Many}</h3>
          <span className="text-sm text-muted-foreground">Coming back soonest first</span>
        </div>
        <ol aria-label={`Session ${noun.many}`} className="flex flex-col gap-2">
          {sortByDueThenDifficulty(cards).map((card, index) => (
            <WordRow
              key={card.id}
              session={session}
              card={card}
              now={now}
              style={{ animationDelay: `${300 + index * 30}ms` }}
            />
          ))}
        </ol>
      </section>

      <div className="flex justify-center">
        <Button variant="cta" className="h-14 rounded-2xl px-8 text-lg" onClick={onNewSession}>
          <Rocket className="size-5" /> Start a new session
        </Button>
      </div>

      <AdvancedPanel open={showAdvanced} onToggle={() => setShowAdvanced(!showAdvanced)}>
        <SessionCards session={session} now={now} />
      </AdvancedPanel>
    </div>
  );
}

/**
 * Words practised in this session: new if none of their cards had been practised before,
 * repeated otherwise.
 */
function countNewAndRepeatedWords(session: Session): { newWords: number; repeatedWords: number } {
  const seenCards = new Set<string>();
  const isNewWord = new Map<string, boolean>();
  for (const review of session.reviews) {
    if (seenCards.has(review.cardId)) continue;
    seenCards.add(review.cardId);
    const { conceptId } = session.cards[review.cardId];
    isNewWord.set(conceptId, (isNewWord.get(conceptId) ?? true) && review.log.state === State.New);
  }
  const newWords = [...isNewWord.values()].filter(Boolean).length;
  return { newWords, repeatedWords: isNewWord.size - newWords };
}

function getHeadline(reviewCount: number, accuracy: number): string {
  if (reviewCount === 0) return 'No answers yet';
  if (accuracy >= 0.9) return 'Stellar work!';
  if (accuracy >= 0.7) return 'Great mission!';
  if (accuracy >= 0.4) return 'Good practice!';
  return 'Every try counts!';
}

function AccuracyRing({ value, empty }: { value: number; empty: boolean }) {
  const radius = 52;
  const length = 2 * Math.PI * radius;
  return (
    <div className="relative grid size-36 shrink-0 place-items-center">
      <svg viewBox="0 0 128 128" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="64" cy="64" r={radius} fill="none" strokeWidth="14" className="stroke-muted" />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={length}
          strokeDashoffset={length * (1 - value)}
          className={cn('animate-ring stroke-correct', (empty || value === 0) && 'hidden')}
          style={{ '--ring-length': length } as CSSProperties}
        />
        <circle
          cx="64"
          cy="64"
          r={radius + 7}
          fill="none"
          strokeWidth="2"
          className="stroke-foreground"
        />
        <circle
          cx="64"
          cy="64"
          r={radius - 7}
          fill="none"
          strokeWidth="2"
          className="stroke-foreground"
        />
      </svg>
      <div className="flex flex-col items-center">
        <span className="font-display text-3xl font-extrabold tabular-nums">
          {empty ? '—' : formatPercent(value)}
        </span>
        <span className="text-xs text-muted-foreground">correct</span>
      </div>
    </div>
  );
}

/** How the answers split across ratings, as one stacked bar with a legend. */
function RatingBar({ reviews }: { reviews: Review[] }) {
  const counts = [...GRADES].reverse().map((grade) => ({
    grade,
    count: reviews.filter((review) => review.rating === grade).length,
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-4 origin-left animate-grow overflow-hidden rounded-full border-2 border-line">
        {counts.map(({ grade, count }) =>
          count > 0 ? (
            <span
              key={grade}
              className={cn('border-r-2 border-line last:border-r-0', GRADE_STYLES[grade].fill)}
              style={{ flexGrow: count }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
        {counts.map(({ grade, count }) => (
          <li key={grade} className="flex items-center gap-1.5">
            <span
              className={cn('size-3 rounded-full border-2 border-line', GRADE_STYLES[grade].fill)}
            />
            {GRADE_LABELS[grade]} <span className="font-semibold tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Practised words by when they come back, so the ones needing more practice lead;
 * ties go to the harder word. Words not seen yet come last.
 */
function sortByDueThenDifficulty(cards: Card[]): Card[] {
  const seen = cards.filter((card) => card.srs.state !== State.New);
  const unseen = cards.filter((card) => card.srs.state === State.New);
  seen.sort(
    (a, b) => a.srs.due.getTime() - b.srs.due.getTime() || b.srs.difficulty - a.srs.difficulty,
  );
  return [...seen, ...unseen];
}

interface WordRowProps {
  session: Session;
  card: Card;
  now: Date;
  style: CSSProperties;
}

function WordRow({ session, card, now, style }: WordRowProps) {
  const { prompt, answer } = getConceptText(session.concepts[card.conceptId]);
  const attempts = session.reviews.filter((review) => review.cardId === card.id);
  const progress = getProgress(card.srs.state);
  const isNew = progress === 'new';
  const { label, Icon } = EXERCISES[card.exerciseType];

  return (
    <li
      style={style}
      className={cn(
        'flex animate-rise flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border-2 px-3 py-2.5',
        isNew ? 'border-transparent bg-muted/50' : 'border-line bg-card shadow-sticker-sm',
      )}
    >
      <span
        className={cn(
          'w-20 shrink-0 rounded-full border-2 px-2 py-0.5 text-center text-xs font-bold',
          PROGRESS_STYLES[progress],
        )}
      >
        {PROGRESS_LABELS[progress]}
      </span>
      <Icon aria-label={label} className="size-4 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
        {prompt && <span className="text-sm text-muted-foreground">{prompt}</span>}
        <span
          className={cn(
            'font-display text-lg leading-tight font-bold break-words',
            isNew && 'text-muted-foreground',
          )}
        >
          {answer}
        </span>
      </span>
      {!isNew && (
        <span className="ml-auto flex items-center gap-3">
          <span className="flex gap-1">
            {attempts.map((review, index) => (
              <span
                key={index}
                title={GRADE_LABELS[review.rating]}
                className={cn(
                  'grid size-6 place-items-center rounded-full border-2 border-line text-xs font-bold',
                  GRADE_STYLES[review.rating].fill,
                )}
              >
                {GRADE_STYLES[review.rating].mark}
              </span>
            ))}
          </span>
          <span className="w-24 text-right text-sm whitespace-nowrap text-muted-foreground">
            back {formatRelative(card.srs.due, now)}
          </span>
        </span>
      )}
    </li>
  );
}

/** The scheduler's view of the session's Cards: state, difficulty, reviews, lapses and next review. */
function SessionCards({ session, now }: { session: Session; now: Date }) {
  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Exercise</TableHead>
          <TableHead>State</TableHead>
          <TableHead className="text-right">Difficulty</TableHead>
          <TableHead className="text-right" title="Every review, right or wrong">
            Reps
          </TableHead>
          <TableHead className="text-right" title="Times forgotten once learned">
            Lapses
          </TableHead>
          <TableHead className="text-right">Next review</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Object.values(session.cards).map((card) => {
          const { prompt, answer } = getConceptText(session.concepts[card.conceptId]);
          return (
            <TableRow key={card.id} className="tabular-nums">
              <TableCell>
                {prompt && `${prompt} → `}
                <span className="font-medium">{answer}</span> · {EXERCISES[card.exerciseType].label}
              </TableCell>
              <TableCell>
                <StateBadge state={card.srs.state} />
              </TableCell>
              <TableCell className="text-right">
                {card.srs.state === State.New ? '—' : formatNumber(card.srs.difficulty, 1)}
              </TableCell>
              <TableCell className="text-right">{card.srs.reps}</TableCell>
              <TableCell className="text-right">{card.srs.lapses}</TableCell>
              <TableCell className="text-right">
                {card.srs.state === State.New ? '—' : formatRelative(card.srs.due, now)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

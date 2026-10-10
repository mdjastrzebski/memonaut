import { RotateCcw } from 'lucide-react';
import { useState, type CSSProperties } from 'react';

import { getProgress, GRADE_STYLES, type Progress } from '@/components/grades';
import { SrsDetails, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Card, Review } from '@/domain/types';
import {
  formatDuration,
  formatNumber,
  formatPercent,
  formatRelative,
  formatSeconds,
} from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Session } from '@/session/session';
import { getRetrievability, GRADES, Rating, ratingName, State, type Grade } from '@/srs/scheduler';

const DAY = 24 * 60 * 60 * 1000;

/** Learner-facing names for the ratings. */
const GRADE_LABELS: Record<Grade, string> = {
  [Rating.Easy]: 'Fast',
  [Rating.Good]: 'Correct',
  [Rating.Hard]: 'Almost',
  [Rating.Again]: 'Missed',
};

const GROUPS: { progress: Progress; title: string; note: string }[] = [
  { progress: 'learning', title: 'Keep practising', note: 'These come back soon.' },
  { progress: 'learned', title: 'Learned', note: 'See you again in a few days.' },
  { progress: 'new', title: 'Not seen yet', note: 'Waiting for the next session.' },
];

interface SummaryScreenProps {
  session: Session;
  onRestart: () => void;
  showSrsDetails: boolean;
  onToggleSrsDetails: () => void;
}

export function SummaryScreen({
  session,
  onRestart,
  showSrsDetails,
  onToggleSrsDetails,
}: SummaryScreenProps) {
  const [now] = useState(() => new Date());
  const cards = Object.values(session.cards);
  const { reviews } = session;
  const correctCount = reviews.filter((review) => review.rating !== Rating.Again).length;
  const accuracy = reviews.length ? correctCount / reviews.length : 0;
  const learnedCount = cards.filter((card) => getProgress(card.srs.state) === 'learned').length;

  const stats: [label: string, value: string][] = [
    ['Answers', String(reviews.length)],
    ['Learned', `${learnedCount}/${cards.length}`],
    ['Fast answers', String(reviews.filter((review) => review.rating === Rating.Easy).length)],
    ['Time', formatDuration(now.getTime() - session.startedAt.getTime())],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="relative flex animate-card-in flex-col items-center gap-6 overflow-hidden rounded-[2rem] border-2 border-foreground bg-card p-6 shadow-sticker-lg sm:flex-row sm:p-10">
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
        {stats.map(([label, value], index) => (
          <div
            key={label}
            className="animate-rise rounded-2xl border-2 border-foreground bg-card p-4 shadow-sticker-sm"
            style={{ animationDelay: `${150 + index * 60}ms` }}
          >
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {GROUPS.map(({ progress, title, note }) => {
        const group = cards.filter((card) => getProgress(card.srs.state) === progress);
        if (group.length === 0) return null;
        return (
          <section key={progress} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-display text-2xl font-bold">{title}</h3>
              <span className="text-sm text-muted-foreground">
                {group.length} · {note}
              </span>
            </div>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((card, index) => (
                <WordTile
                  key={card.id}
                  session={session}
                  card={card}
                  now={now}
                  style={{ animationDelay: `${300 + index * 40}ms` }}
                />
              ))}
            </ul>
          </section>
        );
      })}

      <Button variant="cta" className="mx-auto h-14 rounded-2xl px-8 text-lg" onClick={onRestart}>
        <RotateCcw className="size-5" /> Start a new session
      </Button>

      <SrsDetails open={showSrsDetails} onToggle={onToggleSrsDetails}>
        <SessionSrsTables session={session} now={now} />
      </SrsDetails>
    </div>
  );
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
      <div className="flex h-4 origin-left animate-grow overflow-hidden rounded-full border-2 border-foreground">
        {counts.map(({ grade, count }) =>
          count > 0 ? (
            <span
              key={grade}
              className={cn(
                'border-r-2 border-foreground last:border-r-0',
                GRADE_STYLES[grade].fill,
              )}
              style={{ flexGrow: count }}
            />
          ) : null,
        )}
      </div>
      <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
        {counts.map(({ grade, count }) => (
          <li key={grade} className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-3 rounded-full border-2 border-foreground',
                GRADE_STYLES[grade].fill,
              )}
            />
            {GRADE_LABELS[grade]} <span className="font-semibold tabular-nums">{count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface WordTileProps {
  session: Session;
  card: Card;
  now: Date;
  style: CSSProperties;
}

function WordTile({ session, card, now, style }: WordTileProps) {
  const concept = session.concepts[card.conceptId];
  const attempts = session.reviews.filter((review) => review.cardId === card.id);
  const progress = getProgress(card.srs.state);

  const hint = concept.hint && (
    <span className="font-display text-sm font-bold text-rocket">{concept.hint}</span>
  );

  // Keep answers hidden for words the learner hasn't practised yet.
  if (progress === 'new') {
    return (
      <li
        style={style}
        className="flex animate-rise items-baseline justify-between gap-2 rounded-2xl border-2 border-dashed border-foreground/40 px-3 py-2.5"
      >
        <span className="font-display text-lg font-semibold">{concept.prompt}</span>
        {hint}
      </li>
    );
  }

  return (
    <li
      style={style}
      className="flex animate-rise flex-col gap-2 rounded-2xl border-2 border-foreground bg-card p-3 shadow-sticker-sm"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{concept.prompt}</span>
        {hint}
      </div>
      <span className="font-display text-2xl leading-tight font-bold break-words">
        {concept.answer}
      </span>
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="flex flex-wrap gap-1">
          {attempts.map((review, index) => (
            <span
              key={index}
              title={GRADE_LABELS[review.rating]}
              className={cn(
                'grid size-6 place-items-center rounded-full border-2 border-foreground text-xs font-bold',
                GRADE_STYLES[review.rating].fill,
              )}
            >
              {GRADE_STYLES[review.rating].mark}
            </span>
          ))}
        </span>
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          back {formatRelative(card.srs.due, now)}
        </span>
      </div>
    </li>
  );
}

/** The scheduler's view of the session: card memory states, the review log and a glossary. */
function SessionSrsTables({ session, now }: { session: Session; now: Date }) {
  const cards = Object.values(session.cards);
  const { reviews } = session;

  return (
    <>
      <div>
        <h3 className="font-medium text-foreground">Cards</h3>
        <p>
          Memory state now. R +1d and R +7d show the forgetting curve: the chance of recall if you
          don't review it for a day or a week.
        </p>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Concept</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Reps</TableHead>
              <TableHead className="text-right">Lapses</TableHead>
              <TableHead className="text-right">Stability</TableHead>
              <TableHead className="text-right">Difficulty</TableHead>
              <TableHead className="text-right">R now</TableHead>
              <TableHead className="text-right">R +1d</TableHead>
              <TableHead className="text-right">R +7d</TableHead>
              <TableHead className="text-right">Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => {
              const concept = session.concepts[card.conceptId];
              const isNew = card.srs.state === State.New;
              const r = (offset: number) =>
                isNew
                  ? '—'
                  : formatPercent(getRetrievability(card.srs, new Date(now.getTime() + offset)));
              return (
                <TableRow key={card.id} className="tabular-nums">
                  <TableCell>
                    {concept.prompt} → <span className="font-medium">{concept.answer}</span>
                  </TableCell>
                  <TableCell>
                    <StateBadge state={card.srs.state} />
                  </TableCell>
                  <TableCell className="text-right">{card.srs.reps}</TableCell>
                  <TableCell className="text-right">{card.srs.lapses}</TableCell>
                  <TableCell className="text-right">
                    {isNew ? '—' : formatNumber(card.srs.stability)}
                  </TableCell>
                  <TableCell className="text-right">
                    {isNew ? '—' : formatNumber(card.srs.difficulty)}
                  </TableCell>
                  <TableCell className="text-right">{r(0)}</TableCell>
                  <TableCell className="text-right">{r(DAY)}</TableCell>
                  <TableCell className="text-right">{r(7 * DAY)}</TableCell>
                  <TableCell className="text-right">{formatRelative(card.srs.due, now)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div>
        <h3 className="font-medium text-foreground">Review log</h3>
        <p>Every review in order, with the card's state before → after.</p>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>At</TableHead>
              <TableHead>Concept</TableHead>
              <TableHead>Typed</TableHead>
              <TableHead className="text-right">Time</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Stability</TableHead>
              <TableHead className="text-right">Difficulty</TableHead>
              <TableHead className="text-right">Next in</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reviews.map((review, index) => {
              const concept = session.concepts[session.cards[review.cardId].conceptId];
              const { log, srsAfter } = review;
              const wasNew = log.state === State.New;
              return (
                <TableRow key={index} className="tabular-nums">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    +{formatDuration(log.review.getTime() - session.startedAt.getTime())}
                  </TableCell>
                  <TableCell>{concept.prompt}</TableCell>
                  <TableCell className={GRADE_STYLES[review.rating].text}>
                    {GRADE_STYLES[review.rating].mark} {review.input}
                  </TableCell>
                  <TableCell className="text-right">{formatSeconds(review.elapsedMs)}</TableCell>
                  <TableCell>{ratingName(review.rating)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <StateBadge state={log.state} /> → <StateBadge state={srsAfter.state} />
                  </TableCell>
                  <TableCell className="text-right">
                    {wasNew ? '—' : formatNumber(log.stability)} →{' '}
                    {formatNumber(srsAfter.stability)}
                  </TableCell>
                  <TableCell className="text-right">
                    {wasNew ? '—' : formatNumber(log.difficulty)} →{' '}
                    {formatNumber(srsAfter.difficulty)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatDuration(srsAfter.due.getTime() - log.review.getTime())}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Glossary />
    </>
  );
}

function Glossary() {
  const terms: [term: string, meaning: string][] = [
    [
      'Stability (S)',
      'Days until recall probability falls to 90%. Each successful review raises it; the next interval is roughly S days, because the target retention is 90%.',
    ],
    [
      'Difficulty (D)',
      'How hard the card is for you, from 1 to 10. Again and Hard push it up, Easy pulls it down. Higher D means S grows more slowly.',
    ],
    [
      'Retrievability (R)',
      'Probability you recall the card right now. It starts at 100% after a review and decays along the forgetting curve. The higher S, the slower it decays.',
    ],
    [
      'Learning steps',
      'New cards are shown again after short steps (1m, then 10m) before they graduate to Review with an interval in days. Easy skips the steps.',
    ],
    [
      'Lapse',
      'Forgetting a card in Review (rating Again). It moves to Relearning with a 10m step, and its stability drops.',
    ],
  ];

  return (
    <div>
      <h3 className="mb-2 font-medium text-foreground">How to read this</h3>
      <dl className="grid gap-3 sm:grid-cols-2">
        {terms.map(([term, meaning]) => (
          <div key={term}>
            <dt className="font-medium text-foreground">{term}</dt>
            <dd>{meaning}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

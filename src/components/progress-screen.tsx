import { ChevronDown, ChevronRight, Flame, Star } from 'lucide-react';
import { useState, type CSSProperties, type ReactNode } from 'react';

import { ConceptTable } from '@/components/concept-table';
import { plural } from '@/components/concept-text';
import { EXERCISES } from '@/components/exercise-types';
import { PROGRESS_LABELS, type Progress } from '@/components/grades';
import { SegmentedToggle } from '@/components/segmented-toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Card, Deck } from '@/domain/types';
import { formatMinutes, formatPercent, formatXp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { loadEffortLog, type SessionLog } from '@/progress/effort-log';
import { getTotalXp, loadSessions, type SessionRecord } from '@/progress/session-history';
import {
  DAYS,
  getDailyTotals,
  getDayStarts,
  getDeckExerciseTypes,
  getDeckTimes,
  getStreak,
  summarizePeriod,
} from '@/session/learning-stats';

/** Sets shown under "Most practised". */
const TOP_DECKS = 5;

interface ProgressScreenProps {
  content: Content;
  /** Cards practised so far, keyed by id. */
  cards: Record<string, Card>;
  /** Goes back to the setup screen with this set selected. */
  onSelectDeck: (deck: Deck) => void;
  /** Sessions to show; the logged ones if left out. */
  sessions?: SessionLog[];
  /** Every session's XP and time to show; the saved ones if left out. */
  history?: SessionRecord[];
  now?: Date;
}

type ChartMetric = 'xp' | 'minutes';

/**
 * How the learner is doing over the last 7 days: XP and time per day, the sets practised most, and
 * a set's cards per exercise.
 */
export function ProgressScreen({
  content,
  cards,
  onSelectDeck,
  sessions: givenSessions,
  history: givenHistory,
  now: givenNow,
}: ProgressScreenProps) {
  const [now] = useState(() => givenNow ?? new Date());
  const [sessions] = useState(() => givenSessions ?? loadEffortLog());
  const [history] = useState(() => givenHistory ?? loadSessions());
  const [metric, setMetric] = useState<ChartMetric>('xp');
  // The last 7 study days, today included, and the 7 before them to compare with.
  const periodStart = getDayStarts(now)[0];
  const previousStart = new Date(periodStart);
  previousStart.setDate(previousStart.getDate() - DAYS);
  const recent = summarizePeriod(sessions, periodStart, now);
  const previous = summarizePeriod(sessions, previousStart, periodStart);
  const dailyXp = getDailyTotals(history, now, (session) => session.xp);
  const recentXp = dailyXp.reduce((total, value) => total + value, 0);
  const streak = getStreak(sessions, now);
  const deckTimes = getDeckTimes(sessions, now);
  const findDeck = (id: string) => content.decks.find((deck) => deck.id === id);
  const topDecks = deckTimes.filter((time) => findDeck(time.deckId)).slice(0, TOP_DECKS);
  if (sessions.length === 0 && Object.keys(cards).length === 0 && history.length === 0) {
    return (
      <section className="flex animate-card-in flex-col items-center gap-3 rounded-[2rem] border-2 border-line bg-card p-10 text-center shadow-sticker-lg">
        <h2 className="font-display text-3xl font-extrabold tracking-tight">No progress yet</h2>
        <p className="text-muted-foreground">Finish a session and your XP and time show up here.</p>
      </section>
    );
  }

  const stats: [label: string, value: string, note: ReactNode][] = [
    ['XP', formatXp(recentXp), `${formatXp(getTotalXp(history))} total`],
    ['Time', formatMinutes(recent.activeMs), comparePeriods(recent.activeMs, previous.activeMs)],
    [
      'Days practised',
      `${recent.days} of ${DAYS}`,
      streak > 1 ? (
        <span className="flex items-center gap-1">
          <Flame aria-hidden className="size-3.5 text-rocket" />
          {streak} days in a row
        </span>
      ) : (
        plural(recent.sessions, 'session')
      ),
    ],
    ['New words', String(recent.newConcepts), `7 days before: ${previous.newConcepts}`],
    [
      'Right answers',
      recent.answers ? formatPercent(recent.correct / recent.answers) : '–',
      `of ${plural(recent.answers, 'answer')}`,
    ],
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="flex animate-card-in flex-col gap-6 rounded-[2rem] border-2 border-line bg-card p-6 shadow-sticker-lg sm:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            Your progress · last 7 days
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
            {getHeadline(recentXp, recent.activeMs, previous.activeMs)}
          </h2>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-muted-foreground">
              {metric === 'xp' ? 'XP per day' : 'Minutes per day'}
            </span>
            <SegmentedToggle
              label="Chart"
              options={[
                ['xp', 'XP'],
                ['minutes', 'Minutes'],
              ]}
              value={metric}
              onChange={setMetric}
            />
          </div>
          {metric === 'xp' ? (
            <DailyChart
              label="XP per day"
              values={dailyXp}
              now={now}
              max={10}
              format={(value) => `${formatXp(value)} XP`}
              short={(value) => formatXp(Math.round(value))}
            />
          ) : (
            <DailyChart
              label="Minutes per day"
              values={getDailyTotals(sessions, now, (session) => session.activeMs)}
              now={now}
              max={60_000}
              format={formatMinutes}
              short={(ms) => String(Math.round(ms / 60_000))}
            />
          )}
        </div>
      </section>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {stats.map(([label, value, note], index) => (
          <div
            key={label}
            className="animate-rise rounded-2xl border-2 border-line bg-card p-4 shadow-sticker-sm first:max-lg:col-span-2"
            style={{ animationDelay: `${100 + index * 60}ms` }}
          >
            <dt className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
              {label === 'XP' && <Star aria-hidden className="size-3.5 fill-almost" />}
              {label}
            </dt>
            <dd className="font-display text-3xl font-bold tabular-nums">{value}</dd>
            <dd className="text-xs text-muted-foreground">{note}</dd>
          </div>
        ))}
      </dl>

      {topDecks.length > 0 && (
        <Section title="Most practised" note="Time in each set">
          <ol aria-label="Most practised sets" className="flex flex-col gap-2">
            {topDecks.map((time, index) => {
              const deck = findDeck(time.deckId)!;
              const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
              return (
                <li key={time.deckId}>
                  <button
                    type="button"
                    onClick={() => onSelectDeck(deck)}
                    aria-label={`Practise ${deck.name}`}
                    className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-card p-3 text-left shadow-sticker-sm transition-all outline-none hover:-translate-y-px hover:shadow-sticker focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-4 sm:px-4"
                  >
                    <span className="w-6 text-center font-display text-lg font-bold text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    <span aria-hidden className="text-2xl leading-none">
                      {subject.emoji}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-display text-lg font-bold">{deck.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {subject.name} · {formatMinutes(time.activeMs)} ·{' '}
                        {plural(time.sessions, 'session')}
                      </span>
                    </span>
                    <MiniDays daily={time.daily} className="max-sm:hidden" />
                    <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      <DeckExercises
        content={content}
        cards={cards}
        now={now}
        initialDeck={topDecks.length > 0 ? findDeck(topDecks[0].deckId) : undefined}
      />

      <p className="text-center text-xs text-muted-foreground">
        {sessions.length >= 100
          ? 'Time counts your latest 100 sessions on this device, XP all of them.'
          : 'Time and XP count your sessions on this device.'}
      </p>
    </div>
  );
}

function getHeadline(xp: number, recentMs: number, previousMs: number): string {
  if (recentMs < 60_000 && xp === 0)
    return previousMs ? 'Time for a new mission!' : 'Ready for liftoff?';
  if (xp > 0)
    return recentMs > previousMs ? `${formatXp(xp)} XP, keep going!` : `${formatXp(xp)} XP earned`;
  return recentMs > previousMs
    ? `${formatMinutes(recentMs)} practised, keep going!`
    : `${formatMinutes(recentMs)} practised`;
}

/** The last 7 days' time against the 7 days before them. */
function comparePeriods(recentMs: number, previousMs: number): string {
  const diff = Math.round((recentMs - previousMs) / 60_000);
  if (diff === 0) return 'same as the 7 days before';
  return diff > 0
    ? `${diff} min more than the 7 days before`
    : `7 days before: ${formatMinutes(previousMs)}`;
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-2xl font-bold">{title}</h3>
        {note && <span className="text-sm text-muted-foreground">{note}</span>}
      </div>
      {children}
    </section>
  );
}

interface DailyChartProps {
  label: string;
  /** One value per study day, oldest first, ending with today. */
  values: number[];
  now: Date;
  /** The lowest top of the scale, so a quiet week doesn't look full. */
  max: number;
  /** A value in full, e.g. "12 XP", for its label. */
  format: (value: number) => string;
  /** A value in short, e.g. "12", above its bar. */
  short: (value: number) => string;
}

/** A value per day of the last 7, as bars; today is in full color. */
function DailyChart({ label, values, now, max: minMax, format, short }: DailyChartProps) {
  const starts = getDayStarts(now, values.length);
  const max = Math.max(...values, minMax);
  return (
    <figure className="flex flex-col gap-2">
      <ol aria-label={label} className="flex h-40 items-end gap-2 border-b-2 border-line sm:gap-3">
        {values.map((value, index) => {
          const today = index === values.length - 1;
          const day = today ? 'Today' : formatDay(starts[index]);
          return (
            <li key={index} className="flex h-full flex-1 flex-col justify-end">
              <Tooltip>
                <TooltipTrigger
                  aria-label={`${day}: ${format(value)}`}
                  className="group flex h-full cursor-help flex-col items-center justify-end gap-1 rounded-t-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {value > 0 && (
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums group-hover:text-foreground">
                      {short(value)}
                    </span>
                  )}
                  <span
                    className={cn(
                      'w-full max-w-12 rounded-t-[4px] transition-colors',
                      today ? 'bg-rocket' : 'bg-rocket/45 group-hover:bg-rocket/70',
                    )}
                    style={{ height: `${(value / max) * 100}%`, minHeight: value > 0 ? 3 : 0 }}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  {day}: {format(value)}
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
      <div
        aria-hidden
        className="flex gap-2 text-center text-[0.7rem] text-muted-foreground sm:gap-3"
      >
        {starts.map((start, index) => (
          <span
            key={index}
            className={cn('flex-1', index === starts.length - 1 && 'font-bold text-foreground')}
          >
            {index === starts.length - 1 ? 'Today' : formatWeekday(start)}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** A small bar per day, to compare days at a glance; the full numbers are in its label. */
function MiniDays({ daily, className }: { daily: number[]; className?: string }) {
  const max = Math.max(...daily, 60_000);
  const label = `Minutes per day, last 7 days: ${daily.map((ms) => Math.round(ms / 60_000)).join(', ')}`;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn('flex h-8 items-end gap-0.5', className)}
    >
      {daily.map((ms, index) => (
        <span
          key={index}
          className={cn(
            'w-1.5 rounded-t-[2px]',
            ms === 0 ? 'bg-muted' : index === daily.length - 1 ? 'bg-rocket' : 'bg-rocket/45',
          )}
          style={{ height: ms > 0 ? `${Math.max((ms / max) * 100, 12)}%` : 2 }}
        />
      ))}
    </span>
  );
}

const formatDay = (date: Date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

const formatWeekday = (date: Date) => date.toLocaleDateString(undefined, { weekday: 'short' });

/**
 * A set's Cards per Exercise Type, with each one's share of the set and how well it's known, and
 * its words by Exercise Type.
 */
function DeckExercises({
  content,
  cards,
  now,
  initialDeck,
}: {
  content: Content;
  cards: Record<string, Card>;
  now: Date;
  initialDeck?: Deck;
}) {
  const [deckId, setDeckId] = useState(() => (initialDeck ?? content.decks[0])?.id);
  const deck = content.decks.find((deck) => deck.id === deckId);
  if (!deck) return null;
  const types = getDeckExerciseTypes(deck, cards);
  const total = types.reduce((sum, { progress }) => sum + progress.length, 0);

  return (
    <Section title="Exercises per set" note="Cards of each exercise in a set">
      <div className="flex flex-col gap-4 rounded-[2rem] border-2 border-line bg-card p-6 shadow-sticker sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex min-w-0 items-center gap-2 font-semibold">
            Set
            <span className="relative flex min-w-0">
              <select
                value={deck.id}
                onChange={(event) => setDeckId(event.target.value)}
                className="min-w-0 cursor-pointer appearance-none rounded-xl border-2 border-line bg-card py-1.5 pr-9 pl-3 font-normal outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {content.subjects.map((subject) => (
                  <optgroup key={subject.id} label={subject.name}>
                    {getSubjectDecks(content.decks, subject.id).map((deck) => (
                      <option key={deck.id} value={deck.id}>
                        {deck.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
            </span>
          </label>
          <span className="text-sm text-muted-foreground">{plural(total, 'card')}</span>
        </div>
        <ul aria-label={`Exercises in ${deck.name}`} className="flex flex-col">
          {types.map(({ exerciseType, progress }) => {
            const { label, Icon } = EXERCISES[exerciseType];
            const share = progress.length / total;
            return (
              <li
                key={exerciseType}
                aria-label={`${label}: ${plural(progress.length, 'card')}, ${formatPercent(share)}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 border-b border-foreground/10 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]"
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                </span>
                <span className="text-right text-sm text-muted-foreground tabular-nums sm:order-last">
                  <span className="font-semibold text-foreground">{progress.length}</span> ·{' '}
                  {formatPercent(share)}
                </span>
                <span className="col-span-2 flex sm:col-span-1">
                  <ProgressBar
                    progress={progress}
                    className="min-w-3"
                    style={{ width: `${share * 100}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
        <Legend />
        <ConceptTable
          content={content}
          deck={deck}
          cards={cards}
          exerciseTypes={types.map(({ exerciseType }) => exerciseType)}
          now={now}
        />
      </div>
    </Section>
  );
}

const PROGRESS_ORDER: Progress[] = ['learned', 'learning', 'new'];
const PROGRESS_FILLS: Record<Progress, string> = {
  learned: 'bg-correct',
  learning: 'bg-almost',
  new: 'bg-muted',
};

/** Learned, learning and new words as one bar, in that order. */
function ProgressBar({
  progress,
  className,
  style,
}: {
  progress: Progress[];
  className?: string;
  style?: CSSProperties;
}) {
  const counts = PROGRESS_ORDER.map((status) => ({
    status,
    count: progress.filter((value) => value === status).length,
  }));
  const label = counts
    .map(({ status, count }) => `${PROGRESS_LABELS[status]}: ${count}`)
    .join(', ');
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={style}
      className={cn(
        'flex h-3 gap-0.5 overflow-hidden rounded-full border-2 border-line bg-muted',
        className,
      )}
    >
      {counts.map(
        ({ status, count }) =>
          count > 0 && (
            <span key={status} className={PROGRESS_FILLS[status]} style={{ flexGrow: count }} />
          ),
      )}
    </span>
  );
}

function Legend() {
  return (
    <span className="flex gap-3 text-xs text-muted-foreground">
      {PROGRESS_ORDER.map((status) => (
        <span key={status} className="flex items-center gap-1">
          <span
            aria-hidden
            className={cn('size-2.5 rounded-full border border-line', PROGRESS_FILLS[status])}
          />
          {PROGRESS_LABELS[status]}
        </span>
      ))}
    </span>
  );
}

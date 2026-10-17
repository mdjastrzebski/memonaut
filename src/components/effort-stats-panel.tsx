import { ChevronDown, Download, Gauge, Trash2 } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

import { plural } from '@/components/concept-text';
import { EXERCISES } from '@/components/exercise-types';
import { StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Subject } from '@/domain/types';
import { formatDuration, formatNumber, formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import { clearEffortLog, loadEffortLog, type SessionLog } from '@/progress/effort-log';
import { getAnswerEffort } from '@/session/effort';
import { getEffortStats } from '@/session/effort-stats';

interface EffortStatsPanelProps {
  subjects: Subject[];
  /** Effort points per minute in each Subject. */
  paces: Record<string, number>;
}

/**
 * For tuning the effort points: how long answers took per point by Exercise Type and difficulty,
 * how often Cards were answered against what was expected, and each session's plan against the
 * time it took. Shown with `?dev=1` in the URL.
 */
export function EffortStatsPanel({ subjects, paces }: EffortStatsPanelProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState(loadEffortLog);
  const contentId = useId();

  const clear = () => {
    if (!window.confirm('Clear the effort log? This cannot be undone.')) return;
    clearEffortLog();
    setSessions([]);
  };

  return (
    <section
      aria-label="Effort stats"
      className="rounded-2xl border-2 border-dashed border-foreground/25 bg-card/60 text-xs text-muted-foreground"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left font-medium hover:text-foreground"
      >
        <Gauge className="size-4" />
        <span className="font-display text-sm">Effort stats</span>
        <span>· {plural(sessions.length, 'session')} logged</span>
        <ChevronDown className={cn('ml-auto size-4 transition-transform', !open && '-rotate-90')} />
      </button>

      {open && (
        <div id={contentId} className="flex animate-rise flex-col gap-5 px-4 pb-4">
          <p>
            Pace:{' '}
            {subjects
              .map((subject) => `${subject.name} ${formatNumber(paces[subject.id], 1)} points/min`)
              .join(' · ')}
          </p>
          {sessions.length > 0 ? (
            <EffortTables sessions={sessions} />
          ) : (
            <p>No sessions logged yet. Each session is logged once it's over.</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={sessions.length === 0}
              onClick={() => download(sessions)}
            >
              <Download /> Download JSON
            </Button>
            <Button variant="outline" size="sm" disabled={sessions.length === 0} onClick={clear}>
              <Trash2 /> Clear log
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

function EffortTables({ sessions }: { sessions: SessionLog[] }) {
  const { msPerPoint, types, difficulties, answerCounts } = getEffortStats(sessions);

  return (
    <>
      <StatsTable
        title="Exercise types"
        description={`Time per answer: answering, then reading the feedback until the next exercise shows. Stretches away from the screen are left out. If the points are right, every type takes about the same time per point${msPerPoint > 0 ? `: ${formatSeconds(msPerPoint)} on average` : ''}. Suggested points would make it so.`}
        head={['Type', 'Answers', 'Answering', 'With feedback', 'Per point', 'Points', 'Suggested']}
        rows={types.map((row) => [
          EXERCISES[row.exerciseType].label,
          row.answers,
          formatSeconds(row.medianAnswerMs),
          formatSeconds(row.medianTotalMs),
          formatSeconds(row.msPerPoint),
          formatNumber(row.points, 1),
          formatNumber(row.suggestedPoints, 1),
        ])}
      />
      <StatsTable
        title="Difficulty"
        description="Time per point by the card's FSRS difficulty before the answer. If the difficulty factor is right, each range takes about as long per point as the average: 1.00."
        head={['Difficulty', 'Answers', 'Factor', 'Per point', 'vs average']}
        rows={difficulties.map((row) => [
          row.label,
          row.answers,
          formatNumber(row.factor),
          formatSeconds(row.msPerPoint),
          formatNumber(row.ratio),
        ])}
      />
      <StatsTable
        title="Answers per card"
        description="How many times a card was answered in its session, by its state when the session started, against how many times it was expected to be. Cards not done with when a session ended are left out."
        head={['State', 'Cards', 'Answered', 'Expected']}
        rows={answerCounts.map((row) => [
          <StateBadge key="state" state={row.state} />,
          row.cards,
          formatNumber(row.answers),
          formatNumber(row.expected),
        ])}
      />
      <StatsTable
        title="Sessions"
        description="Latest first. Points planned are by the points when the session started, points done by the current ones."
        head={['Started', 'Set', 'Picked', 'Planned', 'Took', 'Points', 'Cards done', 'Pace']}
        rows={[...sessions].reverse().map((session) => {
          const done = session.cards.filter((card) => card.done).length;
          const effortDone = session.answers.reduce(
            (total, answer) => total + getAnswerEffort(answer.exerciseType, answer),
            0,
          );
          return [
            new Date(session.startedAt).toLocaleString(),
            session.deckId,
            `${session.minutes}m`,
            formatDuration((session.plannedEffort / session.pointsPerMinute) * 60_000),
            formatDuration(session.activeMs),
            `${Math.round(effortDone)} / ${Math.round(session.plannedEffort)}`,
            `${done} / ${session.cards.length}`,
            `${formatNumber(session.pointsPerMinute, 1)} → ${formatNumber(session.paceAfter, 1)}`,
          ];
        })}
      />
    </>
  );
}

interface StatsTableProps {
  title: string;
  description: string;
  head: string[];
  rows: ReactNode[][];
}

function StatsTable({ title, description, head, rows }: StatsTableProps) {
  return (
    <div>
      <h3 className="font-medium text-foreground">{title}</h3>
      <p>{description}</p>
      {rows.length > 0 ? (
        <Table aria-label={title} className="text-xs">
          <TableHeader>
            <TableRow>
              {head.map((label, index) => (
                <TableHead key={label} className={cn(index > 0 && 'text-right')}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => (
              <TableRow key={rowIndex} className="tabular-nums">
                {row.map((cell, index) => (
                  <TableCell key={index} className={cn(index > 0 && 'text-right')}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="mt-1 italic">Not enough data yet.</p>
      )}
    </div>
  );
}

/** Saves the whole log as a JSON file, to look into elsewhere. */
function download(sessions: SessionLog[]) {
  const blob = new Blob([JSON.stringify({ version: 1, sessions }, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `memonaut-effort-log-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

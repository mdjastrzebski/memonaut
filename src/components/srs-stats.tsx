import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDuration, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  getRetrievability,
  GRADES,
  previewReview,
  ratingName,
  State,
  stateName,
  type FsrsCard,
  type Grade,
} from '@/srs/scheduler';

export function StateBadge({ state }: { state: State }) {
  const variant =
    state === State.New ? 'outline' : state === State.Review ? 'default' : 'secondary';
  return <Badge variant={variant}>{stateName(state)}</Badge>;
}

interface CardStatsProps {
  card: FsrsCard;
  now: Date;
}

/** The FSRS memory state of one card at `now`. */
export function CardStats({ card, now }: CardStatsProps) {
  const isNew = card.state === State.New;
  const rows: [label: string, value: ReactNode, help: string][] = [
    [
      'State',
      <StateBadge state={card.state} />,
      'New → Learning → Review; a lapse sends it to Relearning.',
    ],
    ['Reps', card.reps, 'Total reviews of this card.'],
    ['Lapses', card.lapses, 'Times forgotten (Again) while in Review.'],
    [
      'Stability',
      isNew ? '—' : `${formatNumber(card.stability)} d`,
      'Days until recall probability drops to 90%.',
    ],
    ['Difficulty', isNew ? '—' : formatNumber(card.difficulty), '1 (easy) to 10 (hard).'],
    [
      'Retrievability',
      isNew ? '—' : formatPercent(getRetrievability(card, now)),
      'Chance you recall it right now.',
    ],
    ['Due', formatRelative(card.due, now), 'When the scheduler wants to see it next.'],
    [
      'Last review',
      card.last_review ? formatRelative(card.last_review, now) : '—',
      'Time since the previous review.',
    ],
    [
      'Learning step',
      card.state === State.Learning || card.state === State.Relearning ? card.learning_steps : '—',
      'Index into learning steps (1m, 10m) or relearning steps (10m).',
    ],
    ['Scheduled days', card.scheduled_days, 'Interval set at the last review, in whole days.'],
  ];

  return (
    <dl className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-5">
      {rows.map(([label, value, help]) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt>
            <Tooltip>
              <TooltipTrigger
                // Keep focus in the answer input.
                onMouseDown={(event) => event.preventDefault()}
                className="cursor-help underline decoration-dotted underline-offset-2"
              >
                {label}
              </TooltipTrigger>
              <TooltipContent>{help}</TooltipContent>
            </Tooltip>
          </dt>
          <dd className="font-medium text-foreground tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface RatingPreviewProps {
  card: FsrsCard;
  now: Date;
  /** Grade to emphasize; others are dimmed. */
  highlight?: Grade;
}

/** What each rating would do to the card if reviewed at `now`. */
export function RatingPreview({ card, now, highlight }: RatingPreviewProps) {
  const preview = previewReview(card, now);

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Rating</TableHead>
          <TableHead>Next state</TableHead>
          <TableHead className="text-right">Interval</TableHead>
          <TableHead className="text-right">Stability</TableHead>
          <TableHead className="text-right">Difficulty</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {GRADES.map((grade) => {
          const next = preview[grade].card;
          return (
            <TableRow
              key={grade}
              className={cn(
                'tabular-nums',
                highlight !== undefined && grade !== highlight && 'opacity-40',
              )}
            >
              <TableCell className="font-medium">{ratingName(grade)}</TableCell>
              <TableCell>
                <StateBadge state={next.state} />
              </TableCell>
              <TableCell className="text-right">
                {formatDuration(next.due.getTime() - now.getTime())}
              </TableCell>
              <TableCell className="text-right">{formatNumber(next.stability)}</TableCell>
              <TableCell className="text-right">{formatNumber(next.difficulty)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

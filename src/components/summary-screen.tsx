import { useState } from 'react';

import { StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDuration, formatNumber, formatPercent, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Session } from '@/session/session';
import { getRetrievability, GRADES, ratingName, State, stateName } from '@/srs/scheduler';

const DAY = 24 * 60 * 60 * 1000;

interface SummaryScreenProps {
  session: Session;
  onRestart: () => void;
}

export function SummaryScreen({ session, onRestart }: SummaryScreenProps) {
  const [now] = useState(() => new Date());
  const cards = Object.values(session.cards);
  const { reviews } = session;
  const correctCount = reviews.filter((review) => review.correct).length;

  const overview: [label: string, value: string][] = [
    ['Reviews', String(reviews.length)],
    ['Accuracy', reviews.length ? formatPercent(correctCount / reviews.length) : '—'],
    ['Time', formatDuration(now.getTime() - session.startedAt.getTime())],
    ...GRADES.map((grade): [string, string] => [
      ratingName(grade),
      String(reviews.filter((review) => review.rating === grade).length),
    ]),
    ...[State.New, State.Learning, State.Review, State.Relearning].map(
      (state): [string, string] => [
        `${stateName(state)} cards`,
        String(cards.filter((card) => card.srs.state === state).length),
      ],
    ),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="text-2xl font-semibold">Session results · {session.deck.name}</h2>
        <Button className="ml-auto" onClick={onRestart}>
          Start a new session
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {overview.map(([label, value]) => (
          <div key={label} className="rounded-lg border p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-xl font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Cards</CardTitle>
          <CardDescription>
            Memory state now. R +1d and R +7d show the forgetting curve: the chance of recall if you
            don't review it for a day or a week.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
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
                    <TableCell className="text-right">
                      {formatRelative(card.srs.due, now)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Review log</CardTitle>
          <CardDescription>
            Every review in order, with the card's state before → after.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>At</TableHead>
                <TableHead>Concept</TableHead>
                <TableHead>Typed</TableHead>
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
                    <TableCell
                      className={cn(review.correct ? 'text-emerald-600' : 'text-destructive')}
                    >
                      {review.correct ? '✓' : '✗'} {review.input}
                    </TableCell>
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
        </CardContent>
      </Card>

      <Glossary />
    </div>
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
    <Card size="sm">
      <CardHeader>
        <CardTitle>How to read this</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          {terms.map(([term, meaning]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="text-muted-foreground">{meaning}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

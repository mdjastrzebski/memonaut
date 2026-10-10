import { useState, type FormEvent, type KeyboardEvent } from 'react';

import { CardStats, RatingPreview, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { checkAnswer } from '@/exercises/type-answer';
import { formatDuration } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getCurrentCard, LEARN_AHEAD_MS, type Session } from '@/session/session';
import { previewReview, Rating, ratingName, State, type Grade } from '@/srs/scheduler';

interface ExerciseScreenProps {
  session: Session;
  onReview: (review: { input: string; correct: boolean; rating: Grade; now: Date }) => void;
  onEnd: () => void;
}

interface Checked {
  correct: boolean;
  at: Date;
}

export function ExerciseScreen({ session, onReview, onEnd }: ExerciseScreenProps) {
  const [shownAt] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);

  const card = getCurrentCard(session);
  if (!card) return null;

  const concept = session.concepts[card.conceptId];
  const now = checked?.at ?? shownAt;
  const grades: Grade[] = checked?.correct
    ? [Rating.Hard, Rating.Good, Rating.Easy]
    : [Rating.Again];
  const defaultGrade = checked?.correct ? Rating.Good : Rating.Again;
  const preview = previewReview(card.srs, now);
  const earlierReviews = session.reviews.filter((review) => review.cardId === card.id);

  const rate = (rating: Grade) => {
    if (!checked) return;
    onReview({ input, correct: checked.correct, rating, now: checked.at });
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!checked) {
      if (input.trim() === '') return;
      setChecked({ correct: checkAnswer(concept.answer, input), at: new Date() });
    } else {
      rate(defaultGrade);
    }
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!checked) return;
    const grade = Number(event.key) as Grade;
    if (grades.includes(grade)) {
      event.preventDefault();
      rate(grade);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <div className="flex flex-col gap-6">
        <SessionProgress session={session} onEnd={onEnd} />

        <Card>
          <CardHeader>
            <CardDescription>Type in German</CardDescription>
            <CardTitle className="text-4xl">{concept.prompt}</CardTitle>
            {concept.hint && <p className="text-lg text-muted-foreground">{concept.hint}</p>}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex gap-2">
                <Input
                  autoFocus
                  aria-label="Answer"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={input}
                  readOnly={checked !== null}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={handleKeyDown}
                  className={cn(
                    'h-10 text-lg',
                    checked?.correct === true && 'border-emerald-600',
                    checked?.correct === false && 'border-destructive',
                  )}
                />
                {!checked && (
                  <Button type="submit" size="lg" className="h-10">
                    Check
                  </Button>
                )}
              </div>

              {checked && (
                <>
                  <p
                    role="status"
                    className={cn(
                      'font-medium',
                      checked.correct ? 'text-emerald-600' : 'text-destructive',
                    )}
                  >
                    {checked.correct ? 'Correct!' : `Not quite. The answer is "${concept.answer}".`}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {grades.map((grade) => (
                      <Button
                        key={grade}
                        type="button"
                        size="lg"
                        variant={grade === defaultGrade ? 'default' : 'outline'}
                        onClick={() => rate(grade)}
                        className="h-auto flex-col gap-0 py-2"
                      >
                        <span>
                          {ratingName(grade)} <kbd className="opacity-60">{grade}</kbd>
                        </span>
                        <span className="text-xs opacity-70">
                          {formatDuration(preview[grade].card.due.getTime() - now.getTime())}
                        </span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {checked.correct
                      ? 'Pick how hard it felt. Enter = Good.'
                      : 'A wrong answer is always rated Again. Press Enter to continue.'}
                  </p>
                </>
              )}
            </form>
          </CardContent>
        </Card>

        {earlierReviews.length > 0 && (
          <Card size="sm">
            <CardHeader>
              <CardTitle>Earlier in this session</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-sm">
              {earlierReviews.map((review, index) => (
                <span key={index} className="rounded-md border px-2 py-1">
                  {ratingName(review.rating)} → <StateBadge state={review.srsAfter.state} />
                </span>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Card memory state</CardTitle>
            <CardDescription>FSRS state before this review.</CardDescription>
          </CardHeader>
          <CardContent>
            <CardStats card={card.srs} now={now} />
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Rating preview</CardTitle>
            <CardDescription>
              What each rating would do. Cards due within {formatDuration(LEARN_AHEAD_MS)} come back
              in this session.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RatingPreview card={card.srs} now={now} available={checked ? grades : undefined} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SessionProgress({ session, onEnd }: { session: Session; onEnd: () => void }) {
  const cards = Object.values(session.cards);
  const countIn = (state: State) => cards.filter((card) => card.srs.state === state).length;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <span className="font-medium text-foreground">{session.deck.name}</span>
      <span>Reviews: {session.reviews.length}</span>
      <span>Queue: {session.queue.length}</span>
      <span>
        New {countIn(State.New)} · Learning {countIn(State.Learning) + countIn(State.Relearning)} ·
        Review {countIn(State.Review)}
      </span>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onEnd}>
        End session
      </Button>
    </div>
  );
}

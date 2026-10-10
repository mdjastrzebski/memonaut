import { useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

import { SpecialCharacters } from '@/components/special-characters';
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
  specialCharacters?: string[];
  showSpecialCharacters: boolean;
  onToggleSpecialCharacters: () => void;
}

interface Checked {
  correct: boolean;
  at: Date;
}

export function ExerciseScreen({
  session,
  onReview,
  onEnd,
  specialCharacters = [],
  showSpecialCharacters,
  onToggleSpecialCharacters,
}: ExerciseScreenProps) {
  const [shownAt] = useState(() => new Date());
  const [input, setInput] = useState('');
  const [checked, setChecked] = useState<Checked | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // Restore the caret after inserting a special character.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null) {
      inputRef.current?.setSelectionRange(pendingCaret.current, pendingCaret.current);
      pendingCaret.current = null;
    }
  }, [input]);

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

  const insertCharacter = (character: string) => {
    const element = inputRef.current;
    const start = element?.selectionStart ?? input.length;
    const end = element?.selectionEnd ?? input.length;
    pendingCaret.current = start + character.length;
    setInput(input.slice(0, start) + character + input.slice(end));
    element?.focus();
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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <SessionProgress session={session} onEnd={onEnd} />

      <Card className="py-8">
        <CardHeader className="text-center">
          <CardDescription>Type in German</CardDescription>
          <CardTitle className="text-5xl tracking-tight sm:text-6xl">{concept.prompt}</CardTitle>
          {concept.hint && <p className="text-xl text-muted-foreground">{concept.hint}</p>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-md flex-col gap-4">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
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
                  'h-12 text-center text-xl md:text-xl',
                  checked?.correct === true && 'border-emerald-600',
                  checked?.correct === false && 'border-destructive',
                )}
              />
              {!checked && specialCharacters.length > 0 && (
                <Button
                  type="button"
                  variant={showSpecialCharacters ? 'secondary' : 'outline'}
                  size="lg"
                  className="h-12"
                  aria-label="Show special characters"
                  aria-pressed={showSpecialCharacters}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={onToggleSpecialCharacters}
                >
                  äöü
                </Button>
              )}
              {!checked && (
                <Button type="submit" size="lg" className="h-12 px-5">
                  Check
                </Button>
              )}
            </div>

            {!checked && showSpecialCharacters && specialCharacters.length > 0 && (
              <SpecialCharacters characters={specialCharacters} onInsert={insertCharacter} />
            )}

            {checked && (
              <>
                <p
                  role="status"
                  className={cn(
                    'text-center text-lg font-medium',
                    checked.correct ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {checked.correct ? 'Correct!' : `Not quite. The answer is "${concept.answer}".`}
                </p>
                <div className="flex justify-center gap-2">
                  {grades.map((grade) => (
                    <Button
                      key={grade}
                      type="button"
                      size="lg"
                      variant={grade === defaultGrade ? 'default' : 'outline'}
                      onClick={() => rate(grade)}
                      className="h-auto min-w-24 flex-col gap-0 py-2"
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
                <p className="text-center text-xs text-muted-foreground">
                  {checked.correct
                    ? 'Pick how hard it felt. Enter = Good.'
                    : 'A wrong answer is always rated Again. Press Enter to continue.'}
                </p>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <section
        aria-label="SRS details"
        className="flex flex-col gap-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground"
      >
        <div>
          <h2 className="mb-2 font-medium text-foreground">Card memory state (before review)</h2>
          <CardStats card={card.srs} now={now} />
        </div>

        {earlierReviews.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span>Earlier this session:</span>
            {earlierReviews.map((review, index) => (
              <span key={index} className="flex items-center gap-1">
                {ratingName(review.rating)} → <StateBadge state={review.srsAfter.state} />
              </span>
            ))}
          </div>
        )}

        <div>
          <h2 className="font-medium text-foreground">Rating preview</h2>
          <p>
            What each rating would do. Cards due within {formatDuration(LEARN_AHEAD_MS)} come back
            in this session.
          </p>
          <RatingPreview card={card.srs} now={now} available={checked ? grades : undefined} />
        </div>
      </section>
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

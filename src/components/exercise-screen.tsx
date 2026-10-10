import { ChevronDown } from 'lucide-react';
import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react';

import { SpecialCharacters } from '@/components/special-characters';
import { CardStats, RatingPreview, StateBadge } from '@/components/srs-stats';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  getFastLimitMs,
  gradeAnswer,
  type AnswerIssue,
  type AnswerResult,
} from '@/exercises/type-answer';
import { formatDuration, formatSeconds } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  getCurrentCard,
  LEARN_AHEAD_MS,
  type Session,
  type SubmitReviewInput,
} from '@/session/session';
import { previewReview, Rating, ratingName, State, type Grade } from '@/srs/scheduler';

const ISSUE_MESSAGES: Record<AnswerIssue, string> = {
  case: 'capital letters',
  diacritics: 'umlauts or ß',
  typo: 'one letter off',
};

interface ExerciseScreenProps {
  session: Session;
  onReview: (review: SubmitReviewInput) => void;
  onEnd: () => void;
  specialCharacters?: string[];
  showSpecialCharacters: boolean;
  onToggleSpecialCharacters: () => void;
  showSrsDetails: boolean;
  onToggleSrsDetails: () => void;
}

interface Checked {
  result: AnswerResult;
  at: Date;
}

export function ExerciseScreen({
  session,
  onReview,
  onEnd,
  specialCharacters = [],
  showSpecialCharacters,
  onToggleSpecialCharacters,
  showSrsDetails,
  onToggleSrsDetails,
}: ExerciseScreenProps) {
  const srsDetailsId = useId();
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
  const grade = checked?.result.grade;
  const fastLimitMs = getFastLimitMs(concept.answer);
  const preview = previewReview(card.srs, now);
  const earlierReviews = session.reviews.filter((review) => review.cardId === card.id);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!checked) {
      if (input.trim() === '') return;
      const at = new Date();
      const elapsedMs = at.getTime() - shownAt.getTime();
      setChecked({ result: gradeAnswer(concept.answer, input, elapsedMs), at });
    } else {
      const { grade, issues, elapsedMs } = checked.result;
      onReview({ input, elapsedMs, rating: grade, issues, now: checked.at });
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
                className={cn(
                  'h-12 text-center text-xl md:text-xl',
                  grade !== undefined && GRADE_STYLES[grade].border,
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

            {checked && grade !== undefined && (
              <>
                <div role="status" className="flex flex-col gap-2 text-center">
                  <div className={GRADE_STYLES[grade].text}>
                    <p className="text-lg font-medium">{getHeadline(checked.result)}</p>
                    {grade === Rating.Hard || grade === Rating.Again ? (
                      <p>
                        The answer is <span className="font-semibold">{concept.answer}</span>.
                      </p>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Rated <span className="font-medium text-foreground">{ratingName(grade)}</span> ·{' '}
                    {formatSeconds(checked.result.elapsedMs)} · next in{' '}
                    {formatDuration(preview[grade].card.due.getTime() - now.getTime())}
                  </p>
                </div>
                <Button type="submit" size="lg" className="mx-auto h-11 px-8">
                  Continue
                </Button>
              </>
            )}
          </form>
        </CardContent>
      </Card>

      <section
        aria-label="SRS details"
        className="rounded-xl border border-dashed text-xs text-muted-foreground"
      >
        <button
          type="button"
          aria-expanded={showSrsDetails}
          aria-controls={srsDetailsId}
          // Keep focus in the answer input so Enter still checks and continues.
          onMouseDown={(event) => event.preventDefault()}
          onClick={onToggleSrsDetails}
          className="flex w-full items-center gap-1 rounded-xl p-4 text-left font-medium hover:text-foreground"
        >
          <ChevronDown
            className={cn('size-4 transition-transform', !showSrsDetails && '-rotate-90')}
          />
          SRS details
        </button>

        {showSrsDetails && (
          <div id={srsDetailsId} className="flex flex-col gap-4 px-4 pb-4">
            <div>
              <h2 className="mb-2 font-medium text-foreground">
                Card memory state (before review)
              </h2>
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
                Rated automatically: exact within {formatSeconds(fastLimitMs)} → Easy · exact → Good
                · wrong case, missing umlaut or one letter off → Hard · otherwise → Again. Cards due
                within {formatDuration(LEARN_AHEAD_MS)} come back in this session.
              </p>
              <RatingPreview card={card.srs} now={now} highlight={grade} />
            </div>
          </div>
        )}
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

const GRADE_STYLES: Record<Grade, { text: string; border: string }> = {
  [Rating.Again]: { text: 'text-destructive', border: 'border-destructive' },
  [Rating.Hard]: { text: 'text-amber-600', border: 'border-amber-500' },
  [Rating.Good]: { text: 'text-emerald-600', border: 'border-emerald-600' },
  [Rating.Easy]: { text: 'text-emerald-600', border: 'border-emerald-600' },
};

function getHeadline({ grade, issues }: AnswerResult): string {
  switch (grade) {
    case Rating.Easy:
      return 'Correct and fast!';
    case Rating.Good:
      return 'Correct!';
    case Rating.Hard:
      return `Almost! Check: ${issues.map((issue) => ISSUE_MESSAGES[issue]).join(', ')}.`;
    case Rating.Again:
      return 'Not quite.';
  }
}

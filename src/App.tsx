import { useEffect, useState } from 'react';

import { AppMenu } from '@/components/app-menu';
import { ExerciseScreen } from '@/components/exercise-screen';
import { SessionProgress } from '@/components/session-progress';
import { loadSetupChoice, saveSetupChoice, type SessionSize } from '@/components/setup-choice';
import { SetupScreen } from '@/components/setup-screen';
import { SummaryScreen } from '@/components/summary-screen';
import { ThemeToggle } from '@/components/theme-toggle';
import { TooltipProvider } from '@/components/ui/tooltip';
import { content } from '@/data/content';
import type { Card, Deck } from '@/domain/types';
import { useActiveTime } from '@/lib/use-active-time';
import { cn } from '@/lib/utils';
import { loadProgress, saveProgress } from '@/progress/progress-storage';
import {
  createSession,
  getCurrentCard,
  submitReview,
  type Session,
  type SubmitReviewInput,
} from '@/session/session';

export default function App() {
  // Remembered across reloads, so the next visit starts where the last one left off.
  const [initialChoice] = useState(() => loadSetupChoice(content));
  const [deck, setDeck] = useState(initialChoice.deck);
  const [session, setSession] = useState<Session | null>(null);
  // Cards practised in earlier sessions, of every Subject.
  const [cards, setCards] = useState<Record<string, Card>>(() =>
    Object.assign({}, ...content.subjects.map((subject) => loadProgress(subject.id))),
  );
  const [sessionSize, setSessionSize] = useState<SessionSize>(initialChoice.sessionSize);
  const [lastUnitIds, setLastUnitIds] = useState(initialChoice.lastUnitIds);
  const [ended, setEnded] = useState(false);
  const [showSpecialCharacters, setShowSpecialCharacters] = useState(false);
  const [showSrsDetails, setShowSrsDetails] = useState(false);

  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  const finished = session !== null && (ended || !getCurrentCard(session));
  const exercising = session !== null && !finished;
  const allCards = session ? { ...cards, ...session.cards } : cards;
  const getActiveMs = useActiveTime(exercising);

  const start = () => {
    setCards(allCards);
    setSession(
      createSession({
        deck,
        concepts: content.concepts,
        cards: allCards,
        maxConcepts: sessionSize ?? undefined,
        exerciseTypes: subject.exerciseTypes,
      }),
    );
    setEnded(false);
    // Open by default for languages that need special characters, e.g. German umlauts.
    setShowSpecialCharacters((subject.specialCharacters?.length ?? 0) > 0);
  };

  // Saved after every answer, so closing the page mid-session keeps what was practised.
  const review = (input: SubmitReviewInput) => {
    if (!session) return;
    const next = submitReview(session, input);
    const cardId = next.reviews.at(-1)?.cardId;
    if (cardId) saveProgress(session.deck.subjectId, [next.cards[cardId]]);
    setSession(next);
  };

  // Back to the setup screen; mid-session it asks first, since leaving ends the session.
  const goHome = () => {
    if (exercising && !window.confirm('Leave this session? Your answers so far are saved.')) return;
    setCards(allCards);
    setSession(null);
  };

  const selectDeck = (deck: Deck) => {
    setDeck(deck);
    if (deck.kind === 'unit') setLastUnitIds({ ...lastUnitIds, [deck.subjectId]: deck.id });
  };

  useEffect(
    () => saveSetupChoice({ deck, sessionSize, lastUnitIds }),
    [deck, sessionSize, lastUnitIds],
  );

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6">
        {/* During a session the progress sits in the header, lined up with the exercise card. */}
        <header
          className={cn(
            'flex items-center gap-3',
            exercising && 'grid grid-cols-[1fr_minmax(0,42rem)_1fr]',
          )}
        >
          <h1 className="font-display text-2xl font-extrabold tracking-tight">
            <button
              type="button"
              onClick={goHome}
              className="flex cursor-pointer items-center gap-3 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Logo />
              <span className={cn(exercising && 'max-sm:sr-only')}>Memonaut</span>
            </button>
          </h1>
          {exercising && session && <SessionProgress session={session} />}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <AppMenu onEnd={exercising ? () => setEnded(true) : undefined} />
          </div>
        </header>

        {session === null ? (
          <SetupScreen
            content={content}
            cards={cards}
            deck={deck}
            lastUnitIds={lastUnitIds}
            onSelectDeck={selectDeck}
            sessionSize={sessionSize}
            onSessionSizeChange={setSessionSize}
            onStart={start}
          />
        ) : finished ? (
          <SummaryScreen
            session={session}
            activeMs={getActiveMs()}
            onNewSession={goHome}
            showSrsDetails={showSrsDetails}
            onToggleSrsDetails={() => setShowSrsDetails((show) => !show)}
          />
        ) : (
          <ExerciseScreen
            key={session.reviews.length}
            session={session}
            onReview={review}
            subject={subject}
            showSpecialCharacters={showSpecialCharacters}
            onToggleSpecialCharacters={() => setShowSpecialCharacters((show) => !show)}
            showSrsDetails={showSrsDetails}
            onToggleSrsDetails={() => setShowSrsDetails((show) => !show)}
          />
        )}
      </main>
    </TooltipProvider>
  );
}

/** A ringed planet with a moon in orbit. */
function Logo() {
  return (
    <svg viewBox="0 0 48 48" className="size-11 shrink-0" aria-hidden>
      <g className="origin-center animate-orbit">
        <circle cx="24" cy="5" r="3.5" className="fill-almost stroke-foreground" strokeWidth="2" />
      </g>
      <g
        transform="rotate(-20 24 24)"
        fill="none"
        className="stroke-foreground"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        {/* Back half of the ring, hidden behind the planet. */}
        <path d="M4 24 A20 6 0 0 1 44 24" />
        <circle cx="24" cy="24" r="12" className="fill-rocket" />
        <path d="M44 24 A20 6 0 0 1 4 24" />
      </g>
    </svg>
  );
}

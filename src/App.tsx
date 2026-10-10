import { useEffect, useState } from 'react';

import { ExerciseScreen } from '@/components/exercise-screen';
import { DEFAULT_SESSION_SIZE, SetupScreen, type SessionSize } from '@/components/setup-screen';
import { SummaryScreen } from '@/components/summary-screen';
import { TooltipProvider } from '@/components/ui/tooltip';
import { content } from '@/data/content';
import { getSubjectDecks } from '@/data/decks';
import type { Card } from '@/domain/types';
import { createSession, getCurrentCard, submitReview, type Session } from '@/session/session';

export default function App() {
  const [deck, setDeck] = useState(() => getSubjectDecks(content.decks, content.subjects[0].id)[0]);
  const [session, setSession] = useState<Session | null>(null);
  // Cards practised in earlier sessions, so progress carries over until the page is reloaded.
  const [cards, setCards] = useState<Record<string, Card>>({});
  const [sessionSize, setSessionSize] = useState<SessionSize>(DEFAULT_SESSION_SIZE);
  const [ended, setEnded] = useState(false);
  const [showSpecialCharacters, setShowSpecialCharacters] = useState(false);
  const [showSrsDetails, setShowSrsDetails] = useState(false);

  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  const finished = session !== null && (ended || !getCurrentCard(session));
  const studying = session !== null && !finished;
  const allCards = session ? { ...cards, ...session.cards } : cards;

  const start = () => {
    setCards(allCards);
    setSession(
      createSession({
        deck,
        concepts: content.concepts,
        cards: allCards,
        maxConcepts: sessionSize ?? undefined,
      }),
    );
    setEnded(false);
    // Open by default for languages that need special characters, e.g. German umlauts.
    setShowSpecialCharacters((subject.specialCharacters?.length ?? 0) > 0);
  };

  // Nothing is saved, so ask before a reload or closed tab throws the session away. Browsers show
  // their own message here.
  useEffect(() => {
    if (!studying) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [studying]);

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex items-center gap-3">
          <Logo />
          <h1 className="font-display text-2xl font-extrabold tracking-tight">Memonaut</h1>
        </header>

        {session === null ? (
          <SetupScreen
            content={content}
            cards={cards}
            deck={deck}
            onSelectDeck={setDeck}
            sessionSize={sessionSize}
            onSessionSizeChange={setSessionSize}
            onStart={start}
          />
        ) : finished ? (
          <SummaryScreen
            session={session}
            onRestart={start}
            onChooseSet={() => {
              setCards(allCards);
              setSession(null);
            }}
            showSrsDetails={showSrsDetails}
            onToggleSrsDetails={() => setShowSrsDetails((show) => !show)}
          />
        ) : (
          <ExerciseScreen
            key={session.reviews.length}
            session={session}
            onReview={(review) => setSession((current) => current && submitReview(current, review))}
            onEnd={() => window.confirm('End this session?') && setEnded(true)}
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
        <circle cx="24" cy="4" r="3.5" className="fill-almost stroke-foreground" strokeWidth="2" />
      </g>
      <circle cx="24" cy="24" r="12" className="fill-rocket stroke-foreground" strokeWidth="2.5" />
      <ellipse
        cx="24"
        cy="24"
        rx="20"
        ry="6"
        transform="rotate(-20 24 24)"
        fill="none"
        className="stroke-foreground"
        strokeWidth="2.5"
        strokeDasharray="40 8"
      />
    </svg>
  );
}

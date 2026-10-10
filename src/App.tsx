import { useState } from 'react';

import { ExerciseScreen } from '@/components/exercise-screen';
import { SummaryScreen } from '@/components/summary-screen';
import { TooltipProvider } from '@/components/ui/tooltip';
import { content } from '@/data/content';
import { createSession, getCurrentCard, submitReview } from '@/session/session';

const deck = content.decks.find((deck) => deck.id === 'german/numbers-0-10')!;
const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;

function startSession() {
  return createSession({ deck, concepts: content.concepts });
}

export default function App() {
  const [session, setSession] = useState(startSession);
  const [ended, setEnded] = useState(false);
  // Open by default for languages that need special characters, e.g. German umlauts.
  const [showSpecialCharacters, setShowSpecialCharacters] = useState(
    () => (subject.specialCharacters?.length ?? 0) > 0,
  );
  const [showSrsDetails, setShowSrsDetails] = useState(false);

  const finished = ended || !getCurrentCard(session);

  return (
    <TooltipProvider>
      <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight">Memonaut</h1>
            <p className="text-xs text-muted-foreground">
              Demo session · nothing is saved, reloading starts over.
            </p>
          </div>
        </header>

        {finished ? (
          <SummaryScreen
            session={session}
            onRestart={() => {
              setSession(startSession());
              setEnded(false);
            }}
            showSrsDetails={showSrsDetails}
            onToggleSrsDetails={() => setShowSrsDetails((show) => !show)}
          />
        ) : (
          <ExerciseScreen
            key={session.reviews.length}
            session={session}
            onReview={(review) => setSession((current) => submitReview(current, review))}
            onEnd={() => setEnded(true)}
            foreignLanguage={subject.foreignLanguage}
            specialCharacters={subject.specialCharacters}
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

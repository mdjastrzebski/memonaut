import { useState } from 'react';

import { ExerciseScreen } from '@/components/exercise-screen';
import { SummaryScreen } from '@/components/summary-screen';
import { german, germanNumberConcepts, germanNumbersDeck } from '@/data/german-numbers';
import { createSession, getCurrentCard, submitReview } from '@/session/session';

function startSession() {
  return createSession({ deck: germanNumbersDeck, concepts: germanNumberConcepts });
}

export default function App() {
  const [session, setSession] = useState(startSession);
  const [ended, setEnded] = useState(false);
  const [showSpecialCharacters, setShowSpecialCharacters] = useState(false);

  const finished = ended || !getCurrentCard(session);

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Memonaut</h1>
        <p className="text-sm text-muted-foreground">
          Demo session · nothing is saved, reloading starts over.
        </p>
      </header>

      {finished ? (
        <SummaryScreen
          session={session}
          onRestart={() => {
            setSession(startSession());
            setEnded(false);
          }}
        />
      ) : (
        <ExerciseScreen
          key={session.reviews.length}
          session={session}
          onReview={(review) => setSession((current) => submitReview(current, review))}
          onEnd={() => setEnded(true)}
          specialCharacters={german.specialCharacters}
          showSpecialCharacters={showSpecialCharacters}
          onToggleSpecialCharacters={() => setShowSpecialCharacters((show) => !show)}
        />
      )}
    </main>
  );
}

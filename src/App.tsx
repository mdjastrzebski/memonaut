import { ChartColumn } from 'lucide-react';
import { useEffect, useState } from 'react';

import { ActiveTimeReadout } from '@/components/active-time-readout';
import { AppMenu } from '@/components/app-menu';
import { EffortStatsPanel } from '@/components/effort-stats-panel';
import { ExerciseScreen } from '@/components/exercise-screen';
import { ProgressScreen } from '@/components/progress-screen';
import { SessionProgress } from '@/components/session-progress';
import { loadSetupChoice, saveSetupChoice } from '@/components/setup-choice';
import { SetupScreen } from '@/components/setup-screen';
import { SummaryScreen } from '@/components/summary-screen';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { content } from '@/data/bundled-content';
import type { Card, Deck, ExerciseType } from '@/domain/types';
import { useActiveTime } from '@/lib/use-active-time';
import { cn } from '@/lib/utils';
import {
  appendEffortLog,
  finishSessionLog,
  startSessionLog,
  type SessionLog,
} from '@/progress/effort-log';
import { loadPace, savePace } from '@/progress/pace-storage';
import { loadProgress, saveProgress } from '@/progress/progress-storage';
import { updatePace } from '@/session/effort';
import {
  createSession,
  getCurrentCard,
  getEffortDone,
  introduce,
  submitReview,
  type Session,
  type SubmitReviewInput,
  withExerciseTypes,
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
  const [sessionMinutes, setSessionMinutes] = useState(initialChoice.sessionMinutes);
  // Effort points per minute in each Subject, measured after each session.
  const [paces, setPaces] = useState<Record<string, number>>(() =>
    Object.fromEntries(content.subjects.map((subject) => [subject.id, loadPace(subject.id)])),
  );
  // The current session's plan, and once it's over its answers, logged to tune the effort points.
  const [sessionLog, setSessionLog] = useState<SessionLog | null>(null);
  const [lastUnitIds, setLastUnitIds] = useState(initialChoice.lastUnitIds);
  const [ended, setEnded] = useState(false);
  const [showSpecialCharacters, setShowSpecialCharacters] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  // The progress screen, shown instead of the setup screen.
  const [showProgress, setShowProgress] = useState(false);
  // `?dev=1` in the URL shows tools for tuning the app, such as the effort stats.
  const [devMode] = useState(() => new URLSearchParams(window.location.search).get('dev') === '1');
  // In dev mode, Exercise Types left out of sessions, e.g. all but one to try it out.
  const [skippedTypes, setSkippedTypes] = useState<ExerciseType[]>([]);

  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  const finished = session !== null && (ended || !getCurrentCard(session));
  const exercising = session !== null && !finished;
  const allCards = session ? { ...cards, ...session.cards } : cards;
  const { getActiveMs, getIdleMs } = useActiveTime(exercising);
  const pace = paces[subject.id];
  const exerciseTypes = deck.exerciseTypes.filter((type) => !skippedTypes.includes(type));

  // As many Cards, in their usual order, as are expected to fit in the minutes picked.
  const planSession = () =>
    createSession({
      deck: devMode ? withExerciseTypes(deck, exerciseTypes) : deck,
      concepts: content.concepts,
      cards: allCards,
      maxEffort: sessionMinutes * pace,
    });
  // What the next session would hold, shown on the setup screen.
  const plan = session === null ? planSession() : null;

  const start = () => {
    setCards(allCards);
    const planned = planSession();
    setSession(planned);
    setSessionLog(startSessionLog(planned, sessionMinutes, pace));
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
    if (!getCurrentCard(next)) measurePace(next);
  };

  // An intro changes nothing saved: the word's Card stays new until it's answered.
  const finishIntro = () => {
    if (session) setSession(introduce(session));
  };

  // Once a session is over, its points per active minute tune the pace the next one is planned with.
  const measurePace = (over: Session) => {
    const { subjectId } = over.deck;
    const activeMs = getActiveMs();
    const updated = updatePace(paces[subjectId], getEffortDone(over), activeMs);
    savePace(subjectId, updated);
    setPaces({ ...paces, [subjectId]: updated });
    if (sessionLog) appendEffortLog(finishSessionLog(sessionLog, over, activeMs, updated));
  };

  const end = () => {
    if (!session) return;
    setEnded(true);
    measurePace(session);
  };

  // Back to the setup screen; mid-session it asks first, since leaving ends the session.
  const goHome = () => {
    if (exercising && !window.confirm('Leave this session? Your answers so far are saved.')) return;
    if (exercising && session) measurePace(session);
    setCards(allCards);
    setSession(null);
    setShowProgress(false);
  };

  const selectDeck = (deck: Deck) => {
    setDeck(deck);
    if (deck.kind === 'unit') setLastUnitIds({ ...lastUnitIds, [deck.subjectId]: deck.id });
  };

  useEffect(
    () => saveSetupChoice({ deck, sessionMinutes, lastUnitIds }),
    [deck, sessionMinutes, lastUnitIds],
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
            {session === null && (
              <Button
                variant="sticker"
                size="lg"
                aria-pressed={showProgress}
                onClick={() => setShowProgress(!showProgress)}
                className="rounded-full px-3"
              >
                <ChartColumn /> <span className="max-sm:sr-only">Progress</span>
              </Button>
            )}
            <ThemeToggle />
            <AppMenu onEnd={exercising ? end : undefined} />
          </div>
        </header>

        {session === null && showProgress ? (
          <ProgressScreen
            content={content}
            cards={cards}
            onSelectDeck={(deck) => {
              selectDeck(deck);
              setShowProgress(false);
            }}
          />
        ) : session === null ? (
          <>
            <SetupScreen
              content={content}
              cards={cards}
              deck={deck}
              lastUnitIds={lastUnitIds}
              onSelectDeck={selectDeck}
              sessionMinutes={sessionMinutes}
              onSessionMinutesChange={setSessionMinutes}
              plan={plan && { cardCount: plan.queue.length, minutes: plan.effort / pace }}
              onStart={start}
              exerciseTypePicker={
                devMode
                  ? {
                      options: deck.exerciseTypes,
                      selected: exerciseTypes.length > 0 ? exerciseTypes : deck.exerciseTypes,
                      // Skips only the Deck's own, keeping others' as they were picked.
                      onChange: (selected) =>
                        setSkippedTypes([
                          ...skippedTypes.filter((type) => !deck.exerciseTypes.includes(type)),
                          ...deck.exerciseTypes.filter((type) => !selected.includes(type)),
                        ]),
                    }
                  : undefined
              }
            />
            {devMode && <EffortStatsPanel subjects={content.subjects} paces={paces} />}
          </>
        ) : finished ? (
          <SummaryScreen
            session={session}
            subjectKind={subject.kind}
            activeMs={getActiveMs()}
            plannedMinutes={session.effort / (sessionLog?.pointsPerMinute ?? pace)}
            onNewSession={goHome}
          />
        ) : (
          <ExerciseScreen
            key={session.reviews.length}
            session={session}
            onReview={review}
            onIntroduced={finishIntro}
            subject={subject}
            subjectConcepts={content.concepts.filter((concept) => concept.subjectId === subject.id)}
            showSpecialCharacters={showSpecialCharacters}
            onToggleSpecialCharacters={() => setShowSpecialCharacters((show) => !show)}
            advanced={
              devMode
                ? { open: showAdvanced, onToggle: () => setShowAdvanced((show) => !show) }
                : undefined
            }
          />
        )}
        {devMode && exercising && (
          <ActiveTimeReadout getActiveMs={getActiveMs} getIdleMs={getIdleMs} />
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

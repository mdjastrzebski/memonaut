import type { ExerciseType } from '@/domain/types';
import type { AnswerLog, SessionLog } from '@/progress/effort-log';
import { IDLE_TIMEOUT_MS } from '@/session/active-time';
import {
  EXERCISE_EFFORT,
  getAnswerEffort,
  getDifficultyFactor,
  getExpectedAnswers,
} from '@/session/effort';
import { EXERCISE_TYPES } from '@/session/session';
import { State } from '@/srs/scheduler';

/**
 * What logged sessions tell about the effort points, to tune them. If the points were right, every
 * point would take the same time, whatever the Exercise Type or difficulty, and Cards would be
 * answered as often as expected.
 */

/** One answer with the time it took, answering and reading the feedback, and its points. */
interface TimedAnswer {
  answer: AnswerLog;
  /** From showing the exercise until the next one showed. */
  totalMs: number;
  /** By the current points. */
  points: number;
}

/**
 * Answers whose whole time is known: each but the last of a session, as its feedback lasts until
 * the next exercise shows. Answers with a stretch away from the screen are left out.
 */
function getTimedAnswers(sessions: SessionLog[]): TimedAnswer[] {
  return sessions.flatMap(({ answers }) =>
    answers.slice(0, -1).flatMap((answer, index) => {
      const next = answers[index + 1];
      const feedbackMs = next.atMs - next.elapsedMs - answer.atMs;
      if (answer.elapsedMs > IDLE_TIMEOUT_MS || feedbackMs < 0 || feedbackMs > IDLE_TIMEOUT_MS) {
        return [];
      }
      const points = getAnswerEffort(answer.exerciseType, answer);
      return [{ answer, totalMs: answer.elapsedMs + feedbackMs, points }];
    }),
  );
}

export interface TypeStats {
  exerciseType: ExerciseType;
  /** Timed answers. */
  answers: number;
  medianAnswerMs: number;
  medianTotalMs: number;
  /** Median time per point; the same for every type if the points are right. */
  msPerPoint: number;
  points: number;
  /** The points that would make a point take as long as the average one. */
  suggestedPoints: number;
}

export interface DifficultyStats {
  label: string;
  answers: number;
  /** The difficulty factor at the middle of the range. */
  factor: number;
  msPerPoint: number;
  /** Time per point against the average one; 1 if the factor is right. */
  ratio: number;
}

export interface AnswerCountStats {
  state: State;
  /** Cards done with in their session. */
  cards: number;
  /** How many times they were answered, on average. */
  answers: number;
  /** How many times they were expected to be, on average. */
  expected: number;
}

export interface EffortStats {
  /** Median time per point of all timed answers. */
  msPerPoint: number;
  types: TypeStats[];
  difficulties: DifficultyStats[];
  answerCounts: AnswerCountStats[];
}

const DIFFICULTY_RANGES: { label: string; min: number; max: number }[] = [
  { label: '1–3', min: 1, max: 3 },
  { label: '3–5', min: 3, max: 5 },
  { label: '5–7', min: 5, max: 7 },
  { label: '7–10', min: 7, max: 10 },
];

export function getEffortStats(sessions: SessionLog[]): EffortStats {
  const timed = getTimedAnswers(sessions);
  const msPerPoint = medianMsPerPoint(timed);

  const types = EXERCISE_TYPES.flatMap((exerciseType): TypeStats[] => {
    const ofType = timed.filter(({ answer }) => answer.exerciseType === exerciseType);
    if (ofType.length === 0) return [];
    const typeMsPerPoint = medianMsPerPoint(ofType);
    const points = EXERCISE_EFFORT[exerciseType];
    return [
      {
        exerciseType,
        answers: ofType.length,
        medianAnswerMs: median(ofType.map(({ answer }) => answer.elapsedMs)),
        medianTotalMs: median(ofType.map(({ totalMs }) => totalMs)),
        msPerPoint: typeMsPerPoint,
        points,
        suggestedPoints: (points * typeMsPerPoint) / msPerPoint,
      },
    ];
  });

  const difficultyGroups = [
    {
      label: 'New',
      factor: 1,
      answers: timed.filter(({ answer }) => answer.state === State.New),
    },
    ...DIFFICULTY_RANGES.map(({ label, min, max }) => ({
      label,
      factor: (getFactor(min) + getFactor(max)) / 2,
      answers: timed.filter(
        ({ answer }) =>
          answer.state !== State.New &&
          answer.difficulty >= min &&
          (answer.difficulty < max || max === 10),
      ),
    })),
  ];
  const difficulties = difficultyGroups.flatMap(({ label, factor, answers }) => {
    if (answers.length === 0) return [];
    const groupMsPerPoint = medianMsPerPoint(answers);
    return [
      {
        label,
        answers: answers.length,
        factor,
        msPerPoint: groupMsPerPoint,
        ratio: groupMsPerPoint / msPerPoint,
      },
    ];
  });

  const doneCards = sessions.flatMap(({ cards }) => cards.filter((card) => card.done));
  const answerCounts = [State.New, State.Learning, State.Relearning, State.Review].flatMap(
    (state): AnswerCountStats[] => {
      const cards = doneCards.filter((card) => card.state === state);
      if (cards.length === 0) return [];
      return [
        {
          state,
          cards: cards.length,
          answers: mean(cards.map((card) => card.answers)),
          expected: mean(cards.map((card) => getExpectedAnswers(state, card.retrievability))),
        },
      ];
    },
  );

  return { msPerPoint, types, difficulties, answerCounts };
}

/** The difficulty factor of a Card in review with the given FSRS difficulty. */
function getFactor(difficulty: number): number {
  return getDifficultyFactor({ state: State.Review, difficulty });
}

function medianMsPerPoint(answers: TimedAnswer[]): number {
  return median(answers.map(({ totalMs, points }) => totalMs / points));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

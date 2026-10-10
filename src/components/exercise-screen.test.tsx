import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { content } from '@/data/content';
import { HINT_DELAY_MS } from '@/lib/speech';
import { createSession } from '@/session/session';

import { ExerciseScreen } from './exercise-screen';

const utterances: { text: string; onend?: () => void }[] = [];

beforeEach(() => {
  utterances.length = 0;
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal('speechSynthesis', {
    speak: (utterance: { text: string }) => utterances.push(utterance),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const polish = content.subjects.find((subject) => subject.id === 'polish')!;

function renderExercise(conceptId: string) {
  const session = createSession({
    deck: { id: 'd', subjectId: 'polish', kind: 'unit', name: 'D', conceptIds: [conceptId] },
    concepts: content.concepts,
    exerciseTypes: polish.exerciseTypes,
  });
  render(
    <ExerciseScreen
      session={session}
      onReview={() => {}}
      subject={polish}
      showSpecialCharacters={false}
      onToggleSpecialCharacters={() => {}}
      showSrsDetails={false}
      onToggleSrsDetails={() => {}}
    />,
  );
}

test('dictation reads a hint after a homophone, and shows it only after checking', async () => {
  const user = userEvent.setup();
  renderExercise('polish/morze');
  expect(utterances.map((utterance) => utterance.text)).toEqual(['morze']);
  expect(screen.queryByText('zbiornik słonej wody')).not.toBeInTheDocument();

  vi.useFakeTimers();
  act(() => utterances[0].onend?.());
  act(() => vi.advanceTimersByTime(HINT_DELAY_MS));
  vi.useRealTimers();
  expect(utterances.map((utterance) => utterance.text)).toEqual(['morze', 'zbiornik słonej wody']);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'morze{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('zbiornik słonej wody');
});

test('a word without a local word or hint shows only the result after checking', async () => {
  const user = userEvent.setup();
  renderExercise('polish/zolw');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'żółw{Enter}');
  expect(screen.getByRole('status')).not.toHaveTextContent('means');
});

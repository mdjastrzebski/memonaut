import { act, render, screen, within } from '@testing-library/react';
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

function renderExercise(conceptId: string, subject = polish, strictSpelling = true) {
  const session = createSession({
    deck: {
      id: 'd',
      subjectId: subject.id,
      kind: 'unit',
      name: 'D',
      conceptIds: [conceptId],
      strictSpelling,
      exerciseTypes: subject.exerciseTypes,
    },
    concepts: content.concepts,
  });
  render(
    <ExerciseScreen
      session={session}
      onReview={() => {}}
      subject={subject}
      subjectConcepts={[]}
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

test('strict spelling rates a homophone as wrong, not almost right', async () => {
  const user = userEvent.setup();
  renderExercise('polish/morze');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'może{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Again');
});

test('a right answer shows the word with its tricky spellings marked', async () => {
  const user = userEvent.setup();
  renderExercise('polish/zolw');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'żółw{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('żółw');
  expect(status).not.toHaveTextContent('means');
  expect(
    within(status)
      .queryAllByText(/./, { selector: 'mark' })
      .map((mark) => mark.textContent),
  ).toEqual(['żó']);
});

test('a wrong answer compares it with the answer instead', async () => {
  const user = userEvent.setup();
  renderExercise('polish/zolw');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'żułw{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Again');
  expect(within(status).getByText('ó', { selector: 'mark' })).toBeInTheDocument();
  expect(within(status).queryByText('żó', { selector: 'mark' })).not.toBeInTheDocument();
});

test('math answers are not read aloud', async () => {
  const user = userEvent.setup();
  const math = content.subjects.find((subject) => subject.id === 'math')!;
  renderExercise('math/square-7', math);
  expect(screen.getByRole('heading', { name: '7² =' })).toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '49{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Easy');
  expect(utterances).toEqual([]);
});

test('an answer explanation is shown with the result instead of the local word', async () => {
  const user = userEvent.setup();
  const math = content.subjects.find((subject) => subject.id === 'math')!;
  renderExercise('math/square-3', math);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '8{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('3² = 9');
  expect(status).not.toHaveTextContent('means');
});

test('a numeric answer must be exact, even in a deck without strict spelling', async () => {
  const user = userEvent.setup();
  const math = content.subjects.find((subject) => subject.id === 'math')!;
  renderExercise('math/square-7', math, false);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '48{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Again');
});

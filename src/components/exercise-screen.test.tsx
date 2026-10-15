import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Concept, ExerciseType } from '@/domain/types';
import { HINT_DELAY_MS } from '@/lib/speech';
import { createSession } from '@/session/session';
import { testContent as content } from '@/test/content';

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

/** Its first exercise, in a bundled unit deck holding only it. */
function renderExercise(
  conceptId: string,
  strictSpelling = true,
  exerciseTypes?: ExerciseType[],
  subjectConcepts: Concept[] = [],
) {
  const deck = content.decks.find(
    (deck) => deck.kind === 'unit' && deck.conceptIds.includes(conceptId),
  )!;
  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  const session = createSession({
    deck: {
      ...deck,
      conceptIds: [conceptId],
      strictSpelling,
      ...(exerciseTypes && { exerciseTypes, conceptExerciseTypes: undefined }),
    },
    concepts: content.concepts,
  });
  render(
    <ExerciseScreen
      session={session}
      onReview={() => {}}
      subject={subject}
      subjectConcepts={subjectConcepts}
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

test('questions are not read aloud', async () => {
  const user = userEvent.setup();
  renderExercise('math/square-7');
  expect(screen.getByRole('heading', { name: '7² =' })).toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '49{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Easy');
  expect(utterances).toEqual([]);
});

test("a question's explanation is shown with the result, not a meaning", async () => {
  const user = userEvent.setup();
  renderExercise('math/square-3');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '8{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('3² = 9');
  expect(status).not.toHaveTextContent('means');
});

test('a numeric answer must be exact, even in a deck without strict spelling', async () => {
  const user = userEvent.setup();
  renderExercise('math/square-7', false);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), '48{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Again');
});

test('a question with choices is picked first from its answer and its own wrong choices', async () => {
  const user = userEvent.setup();
  renderExercise('math/mixed-2-times-3sq');
  expect(screen.getByRole('heading', { name: '2 · 3² =' })).toBeInTheDocument();
  const options = within(screen.getByRole('group', { name: 'Options' })).getAllByRole('button');
  expect(options.map((option) => option.textContent?.slice(1)).sort()).toEqual([
    '11',
    '12',
    '18',
    '36',
  ]);

  await user.click(screen.getByRole('button', { name: /36/ }));
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Again');
  expect(status).toHaveTextContent('2 · 3² = 18');
  expect(screen.queryByRole('button', { name: 'Listen again' })).not.toBeInTheDocument();
  expect(utterances).toEqual([]);
});

test('translation takes an alternative answer, and compares a mistake with the closest one', async () => {
  const user = userEvent.setup();
  renderExercise('german/number-100', false, ['translation']);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'einhundrt{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Hard');
  expect(screen.getByRole('status')).toHaveTextContent('einhundert');
  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), 'einhundert');
  expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
});

test('German article choice shows the noun without its article, and reads the word once picked', async () => {
  const user = userEvent.setup();
  renderExercise('german/das-buch', false, ['article-choice-de']);
  expect(screen.getByRole('heading', { name: 'Buch' })).toBeInTheDocument();
  const options = within(screen.getByRole('group', { name: 'Options' })).getAllByRole('button');
  expect(options.map((option) => option.textContent?.slice(1))).toEqual(['der', 'die', 'das']);
  expect(utterances).toEqual([]);

  await user.keyboard('1');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Again');
  expect(status).toHaveTextContent('das Buch');
  expect(utterances.map((utterance) => utterance.text)).toEqual(['das Buch']);
});

test('German article choice tells what gives the article away', async () => {
  const user = userEvent.setup();
  renderExercise('german/der-fussball', false, ['article-choice-de'], content.concepts);
  await user.keyboard('1');
  expect(screen.getByRole('status')).toHaveTextContent('der Fußball jak der Ball');
});

test('German article choice shows a rule from the ending, or the word explanation instead', async () => {
  const user = userEvent.setup();
  renderExercise('german/das-maeppchen', false, ['article-choice-de']);
  await user.keyboard('3');
  expect(screen.getByRole('status')).toHaveTextContent('na -chen → zawsze das');
});

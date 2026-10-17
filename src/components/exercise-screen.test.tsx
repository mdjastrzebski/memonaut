import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { Concept, ExerciseType } from '@/domain/types';
import { HINT_DELAY_MS } from '@/lib/speech';
import { createSession, submitReview } from '@/session/session';
import { Rating } from '@/srs/scheduler';
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

/**
 * Its first exercise, in a bundled unit deck holding only it, past the word's intro unless
 * `intro` is set, and missed once already in the session if `missed` is set.
 */
function renderExercise(
  conceptId: string,
  strictSpelling = true,
  exerciseTypes?: ExerciseType[],
  subjectConcepts: Concept[] = [],
  { intro = false, tricky = false, missed = false, onIntroduced = () => {} } = {},
) {
  const deck = content.decks.find(
    (deck) => deck.kind === 'unit' && deck.conceptIds.includes(conceptId),
  )!;
  const subject = content.subjects.find((subject) => subject.id === deck.subjectId)!;
  let session = createSession({
    deck: {
      ...deck,
      conceptIds: [conceptId],
      strictSpelling,
      ...(exerciseTypes && { exerciseTypes, conceptExerciseTypes: undefined }),
    },
    concepts: content.concepts,
  });
  if (missed) {
    const missedSession = submitReview(session, {
      input: '',
      elapsedMs: 1000,
      issues: [],
      rating: Rating.Again,
      now: new Date(),
    });
    session = { ...missedSession, queue: session.queue };
  }
  render(
    <ExerciseScreen
      session={{
        ...session,
        intros: intro ? session.intros : [],
        tricky: tricky ? [conceptId] : [],
      }}
      onReview={() => {}}
      onIntroduced={onIntroduced}
      subject={subject}
      subjectConcepts={subjectConcepts}
      showSpecialCharacters={false}
      onToggleSpecialCharacters={() => {}}
    />,
  );
}

test('a new word is introduced with its meaning and read aloud before its first exercise', async () => {
  const user = userEvent.setup();
  const onIntroduced = vi.fn();
  renderExercise('german/das-buch', true, undefined, [], { intro: true, onIntroduced });

  const intro = screen.getByRole('region', { name: 'New word' });
  expect(within(intro).getByRole('heading', { level: 2 })).toHaveTextContent('das Buch');
  expect(intro).toHaveTextContent('=meansksiążka');
  expect(utterances.map((utterance) => utterance.text)).toEqual(['das Buch']);
  expect(screen.queryByRole('group', { name: 'Options' })).not.toBeInTheDocument();

  await user.click(within(intro).getByRole('button', { name: 'Listen' }));
  expect(utterances).toHaveLength(2);
  // Continue is focused, so Enter moves on.
  await user.keyboard('{Enter}');
  expect(onIntroduced).toHaveBeenCalledOnce();
});

test('a tricky word is introduced again as one', () => {
  renderExercise('german/das-buch', true, undefined, [], { intro: true, tricky: true });
  const intro = screen.getByRole('region', { name: 'Tricky word' });
  expect(within(intro).getByRole('heading', { level: 2 })).toHaveTextContent('das Buch');
  expect(intro).toHaveTextContent('=meansksiążka');
});

test('a new cloze sentence is introduced with its gap filled in and read aloud', () => {
  renderExercise('german/cloze-das-buch-von-anna', false, undefined, [], { intro: true });
  expect(screen.getByText('New sentence')).toBeInTheDocument();
  expect(screen.getByRole('heading')).toHaveTextContent('das ist das Buch von Anna');
  expect(screen.getByText('książka Anny')).toBeInTheDocument();
  expect(utterances.map((utterance) => utterance.text)).toEqual(['das ist das Buch von Anna']);
});

test('a new question is introduced with its answer and explanation, not read aloud', () => {
  const question = content.concepts.find((concept) => concept.kind === 'knowledge')!;
  renderExercise(question.id, true, undefined, [], { intro: true });
  const intro = screen.getByRole('region', { name: 'New question' });
  expect(within(intro).getByRole('heading', { level: 2 })).toHaveTextContent(question.question);
  expect(intro).toHaveTextContent(`=answer${question.answer}`);
  expect(utterances).toEqual([]);
  expect(within(intro).queryByRole('button', { name: 'Listen' })).not.toBeInTheDocument();
});

test('a new spelling word is introduced with its spoken hint instead of a meaning', () => {
  renderExercise('polish/morze', true, undefined, [], { intro: true });
  const intro = screen.getByRole('region', { name: 'New word' });
  expect(within(intro).getByRole('heading', { level: 2 })).toHaveTextContent('morze');
  expect(intro).toHaveTextContent('zbiornik słonej wody');
});

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
  // Fixed from the answer given, with the caret where the missing letter goes.
  const retype = screen.getByRole('textbox', { name: 'Retype answer' });
  expect(retype).toHaveValue('einhundrt');
  expect(screen.getByText('Fix the marked letters to continue:')).toBeInTheDocument();
  await user.keyboard('e');
  expect(retype).toHaveValue('einhundert');
  expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
});

test('a close mistake selects the first wrong letter to fix', async () => {
  const user = userEvent.setup();
  renderExercise('german/number-100', false, ['translation']);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'hundart{Enter}');
  const retype = screen.getByRole('textbox', { name: 'Retype answer' });
  expect(retype).toHaveValue('hundart');
  await user.keyboard('e');
  expect(retype).toHaveValue('hundert');
  expect(screen.getByRole('button', { name: /continue/i })).toBeEnabled();
});

test('a second miss in the session says the word is left for next time', async () => {
  const user = userEvent.setup();
  renderExercise('german/number-100', false, ['translation'], [], { missed: true });

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'tausend{Enter}');
  expect(screen.getByText("We'll practise this one again next time.")).toBeInTheDocument();
});

test('a first miss in the session comes back without a note', async () => {
  const user = userEvent.setup();
  renderExercise('german/number-100', false, ['translation']);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'tausend{Enter}');
  expect(screen.queryByText("We'll practise this one again next time.")).not.toBeInTheDocument();
});

test('a wrong answer far from the right one is retyped from scratch', async () => {
  const user = userEvent.setup();
  renderExercise('german/number-100', false, ['translation']);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'tausend{Enter}');
  expect(screen.getByRole('textbox', { name: 'Retype answer' })).toHaveValue('');
  expect(screen.getByText('Now type the answer to continue:')).toBeInTheDocument();
});

test('plural form shows the word and asks for its plural, then shows how it is made', async () => {
  const user = userEvent.setup();
  renderExercise('german/das-buch', false, ['plural-form']);
  expect(screen.getByRole('heading', { name: 'das Buch' })).toBeInTheDocument();
  expect(screen.getByText('Plural')).toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'die Bücher{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('książki');
  expect(status).toHaveTextContent('das Buch → die Bücher');
  expect(utterances.map((utterance) => utterance.text)).toEqual(['die Bücher']);
});

test('cloze shows the word with a gap and its meaning, and forgives a typo in a phrase', async () => {
  const user = userEvent.setup();
  renderExercise('german/cloze-das-buch-von-anna', false, ['cloze']);
  expect(screen.getByRole('heading')).toHaveTextContent('das ist das Buch');
  expect(screen.getByText('książka Anny')).toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'von Ana{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Hard');
  expect(status).toHaveTextContent('das ist das Buch von Anna');
  expect(utterances.map((utterance) => utterance.text)).toEqual(['das ist das Buch von Anna']);
});

test('cloze with a one-word gap forgives no typo, as one letter off is another word', async () => {
  const user = userEvent.setup();
  renderExercise('german/cloze-das-buch', false, ['cloze']);
  expect(screen.getByRole('heading')).toHaveTextContent('das ist Buch');

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'dar{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Again');
});

test('translation plural shows the local plural and asks for the foreign one', async () => {
  const user = userEvent.setup();
  renderExercise('german/das-buch', false, ['translation-plural']);
  expect(screen.getByRole('heading', { name: 'książki' })).toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'die Bucher{Enter}');
  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Hard');
  expect(status).toHaveTextContent('das Buch → die Bücher');
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

test('German article choice offers the forms of a possessive', async () => {
  const user = userEvent.setup();
  renderExercise('german/meine-lampe', false, ['article-choice-de']);
  expect(screen.getByText('Mein or meine?')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Lampe' })).toBeInTheDocument();
  const options = within(screen.getByRole('group', { name: 'Options' })).getAllByRole('button');
  expect(options.map((option) => option.textContent?.slice(1))).toEqual(['mein', 'meine']);

  await user.keyboard('2');
  const status = screen.getByRole('status');
  expect(status).not.toHaveTextContent('Again');
  expect(status).toHaveTextContent('na -e → zwykle die');
});

test("German article choice offers dieser, diese and dieses in their genders' colors", async () => {
  const user = userEvent.setup();
  renderExercise('german/dieses-buch', false, ['article-choice-de'], content.concepts);
  expect(screen.getByText('Dieser, diese or dieses?')).toBeInTheDocument();
  const options = within(screen.getByRole('group', { name: 'Options' })).getAllByRole('button');
  expect(options.map((option) => option.textContent?.slice(1))).toEqual([
    'dieser',
    'diese',
    'dieses',
  ]);
  expect(within(options[2]).getByText('dieses')).toHaveClass('text-emerald-600');

  await user.keyboard('3');
  expect(screen.getByRole('status')).toHaveTextContent('dieses Buch jak das Buch');
});

test('German article choice links a possessive to the noun with its article', async () => {
  const user = userEvent.setup();
  renderExercise('german/mein-ball', false, ['article-choice-de'], content.concepts);
  await user.keyboard('1');
  expect(screen.getByRole('status')).toHaveTextContent('mein Ball jak der Ball');
});

test('German article choice shows a rule from the ending, or the word explanation instead', async () => {
  const user = userEvent.setup();
  renderExercise('german/das-maeppchen', false, ['article-choice-de']);
  await user.keyboard('3');
  expect(screen.getByRole('status')).toHaveTextContent('na -chen → zawsze das');
});

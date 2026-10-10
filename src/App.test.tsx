import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import App from './App';
import { content } from './data/content';

// jsdom has no speech synthesis; record what would be read aloud instead.
const spoken: string[] = [];
const confirm = vi.fn(() => true);

beforeEach(() => {
  spoken.length = 0;
  confirm.mockClear();
  vi.stubGlobal('confirm', confirm);
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
    getVoices: () => [],
    cancel: () => {},
    speak: (utterance: { text: string }) => spoken.push(utterance.text),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const numbers = content.decks.find((deck) => deck.id === 'german/numbers-0-10')!;
const numberConcepts = content.concepts.filter((concept) =>
  numbers.conceptIds.includes(concept.id),
);

/** Opens the app and starts a session of German numbers 0–10. */
async function startNumbersSession(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('radio', { name: 'German' }));
  await user.click(screen.getByRole('radio', { name: 'Numbers 0–10' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
}

/** The word read aloud in a dictation exercise, or the one shown in a translation exercise. */
function currentConcept() {
  const heading = screen.queryByRole('heading', { level: 2 });
  return heading
    ? numberConcepts.find((concept) => concept.local === heading.textContent)!
    : numberConcepts.find((concept) => concept.foreign === spoken.at(-1))!;
}

/** The session progress bar's value, in percent. */
function progress() {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
}

async function retypeAnswer(user: ReturnType<typeof userEvent.setup>) {
  const { foreign: answer } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), `${answer}{Enter}`);
}

test('rates a fast exact answer as Easy and continues on Enter', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  expect(progress()).toBe(0);

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, `${currentConcept().foreign}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent('Easy');

  await user.keyboard('{Enter}');
  expect(progress()).toBeGreaterThan(0);
});

test('rates an answer with wrong capitalization as Hard and asks to retype it', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const { foreign: answer } = currentConcept();
  const capitalized = answer[0].toUpperCase() + answer.slice(1);
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${capitalized}{Enter}`);

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Hard');
  // Only the first letter is marked, in both what was typed and the answer.
  expect(within(status).getAllByText(capitalized[0], { selector: 'mark' })).toHaveLength(1);
  expect(within(status).getAllByText(answer[0], { selector: 'mark' })).toHaveLength(1);

  const retype = screen.getByRole('textbox', { name: 'Retype answer' });
  const continueButton = screen.getByRole('button', { name: 'Continue' });
  expect(retype).toHaveFocus();
  expect(continueButton).toBeDisabled();

  // The same mistake again doesn't count.
  await user.type(retype, `${capitalized}{Enter}`);
  expect(continueButton).toBeDisabled();
  expect(progress()).toBe(0);

  await user.clear(retype);
  await user.type(retype, `${answer}{Enter}`);
  expect(progress()).toBeGreaterThan(0);
});

test('rates a wrong answer as Again and shows it next to the answer', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const { foreign: answer, local } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Again');
  expect(status).toHaveTextContent('You typedfalsch');
  expect(status).toHaveTextContent(`Answer${answer}`);
  expect(status).toHaveTextContent(local);
  expect(within(status).queryAllByText(/./, { selector: 'mark' })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /^(Hard|Good|Easy)/ })).not.toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), `${answer}{Enter}`);
  expect(progress()).toBeGreaterThan(0);
});

test('SRS details start collapsed and stay expanded across exercises', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const toggle = () => screen.getByRole('button', { name: 'SRS details' });
  expect(toggle()).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByText('Rating preview')).not.toBeInTheDocument();

  await user.click(toggle());
  expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Rating preview')).toBeInTheDocument();

  await user.hover(screen.getByRole('button', { name: 'Stability' }));
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    'Days until recall probability drops to 90%.',
  );

  const input = screen.getByRole('textbox', { name: 'Answer' });
  expect(input).toHaveFocus();
  await user.type(input, 'falsch{Enter}');
  await retypeAnswer(user);

  expect(progress()).toBeGreaterThan(0);
  expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Rating preview')).toBeInTheDocument();
});

test('ending the session shows results with SRS details collapsed', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  await retypeAnswer(user);
  await user.click(screen.getByRole('button', { name: 'End session' }));
  expect(confirm).toHaveBeenCalledOnce();

  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Keep practising' })).toBeInTheDocument();
  expect(screen.queryByText('Review log')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'SRS details' }));
  expect(screen.getByText('Review log')).toBeInTheDocument();
});

test('typing after the answer box loses focus types into it, and Enter checks the answer', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.click(document.body);
  expect(input).not.toHaveFocus();

  // Enter with nothing typed does nothing.
  await user.keyboard('{Enter}');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(input).toHaveFocus();

  await user.click(document.body);
  await user.keyboard('falsch');
  expect(input).toHaveValue('falsch');
  expect(input).toHaveFocus();

  await user.click(document.body);
  await user.keyboard('{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Again');
});

test('special characters keyboard starts open for German and can be hidden', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const toggle = screen.getByRole('button', { name: 'Show special characters' });
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('group', { name: 'Special characters' })).toBeInTheDocument();

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('group', { name: 'Special characters' })).not.toBeInTheDocument();
});

test('special characters keyboard inserts at the caret', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  const keyboard = screen.getByRole('group', { name: 'Special characters' });

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, 'fnf');
  await user.keyboard('{ArrowLeft}{ArrowLeft}');
  await user.click(within(keyboard).getByRole('button', { name: 'ü' }));
  await user.keyboard('x');

  expect(input).toHaveValue('füxnf');
  expect(input).toHaveFocus();
});

test('dictation reads the word aloud and shows its meaning only after checking', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  expect(spoken).toHaveLength(1);
  const { local, foreign, hint } = currentConcept();
  expect(screen.queryByText(local)).not.toBeInTheDocument();
  expect(screen.queryByText(hint!)).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Listen' }));
  expect(spoken).toEqual([foreign, foreign]);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${foreign}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent(local);
  expect(screen.queryByText(hint!)).not.toBeInTheDocument();
});

test('translation exercises come after every dictation exercise', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  let dictations = 0;
  while (screen.queryByRole('button', { name: 'Listen' })) {
    // A fast exact answer is rated Easy, so the card leaves the session.
    await user.type(
      screen.getByRole('textbox', { name: 'Answer' }),
      `${currentConcept().foreign}{Enter}`,
    );
    await user.keyboard('{Enter}');
    dictations++;
  }

  expect(dictations).toBe(11);
  const { local, foreign } = currentConcept();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(local);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  // The German word is read aloud only after checking the answer.
  const spokenBefore = spoken.length;
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch');
  expect(spoken).toHaveLength(spokenBefore);
  await user.keyboard('{Enter}');
  expect(spoken.slice(spokenBefore)).toEqual([foreign]);
});

test('ending the session asks first and stays on cancel', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  confirm.mockReturnValueOnce(false);
  await user.click(screen.getByRole('button', { name: 'End session' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole('textbox', { name: 'Answer' })).toBeInTheDocument();
});

test('asks before leaving the page during a session, not on the setup screen', async () => {
  const user = userEvent.setup();
  render(<App />);
  const beforeSession = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(beforeSession);
  expect(beforeSession.defaultPrevented).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Start session' }));
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});

test('setup offers each subject with its core set selected first', async () => {
  const user = userEvent.setup();
  render(<App />);

  const subjects = screen.getByRole('group', { name: 'Subject' });
  expect(
    within(subjects)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label')),
  ).toEqual(['English', 'German']);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  expect(screen.getByRole('radio', { name: 'Essentials' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Kapitel 1' })).not.toBeChecked();

  const selected = screen.getByRole('region', { name: 'Selected set' });
  expect(within(selected).getByRole('heading', { name: 'Essentials' })).toBeInTheDocument();
  expect(within(selected).getByText('Words').nextSibling).toHaveTextContent('30');
  expect(within(selected).getByText('Exercises').nextSibling).toHaveTextContent('60');
  expect(within(selected).getByText('Only in this set')).toBeInTheDocument();
});

test('picking a unit shows its stats and words, and starts a session of it', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  await user.click(screen.getByRole('radio', { name: 'Numbers 0–10' }));

  const selected = screen.getByRole('region', { name: 'Selected set' });
  expect(within(selected).getByText('Words').nextSibling).toHaveTextContent('11');
  // Numbers 0–10 are also in the core set and in Kapitel 1.
  expect(within(selected).getByText('Essentials').parentElement).toHaveTextContent('11');
  expect(within(selected).getByText('Kapitel 1').parentElement).toHaveTextContent('11');

  await user.click(within(selected).getByRole('button', { name: 'Show 11 words' }));
  const words = within(selected).getByRole('list', { name: 'Words in set' });
  expect(within(words).getAllByRole('listitem')).toHaveLength(11);
  expect(words).toHaveTextContent('zwei');

  await user.click(within(selected).getByRole('button', { name: 'Start session' }));
  expect(screen.getByText('Numbers 0–10')).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Answer' })).toBeInTheDocument();
});

test('switching subject selects its core set and English has no special characters', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  await user.click(screen.getByRole('radio', { name: 'Kapitel 0' }));
  await user.click(screen.getByRole('radio', { name: 'English' }));
  expect(screen.getByRole('radio', { name: 'Essentials' })).toBeChecked();

  await user.click(screen.getByRole('radio', { name: 'Colours' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  expect(screen.queryByRole('button', { name: 'Show special characters' })).not.toBeInTheDocument();
});

test('the summary leads back to the setup screen with the same set selected', async () => {
  const user = userEvent.setup();
  await startNumbersSession(user);

  await user.click(screen.getByRole('button', { name: 'End session' }));
  await user.click(screen.getByRole('button', { name: 'Choose another set' }));

  expect(screen.getByRole('radio', { name: 'Numbers 0–10' })).toBeChecked();
});

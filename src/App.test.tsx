import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import App from './App';
import { content } from './data/content';
import type { LanguageConcept } from './domain/types';
import { FAST_CHOICE_MS } from './exercises/multiple-choice';

// jsdom has no speech synthesis; record what would be read aloud instead.
const spoken: string[] = [];
const confirm = vi.fn(() => true);

beforeEach(() => {
  // Keeps the session queue in deck order, so it starts with the first Essentials word.
  vi.spyOn(Math, 'random').mockReturnValue(0.99);
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
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const essentials = content.decks.find((deck) => deck.id === 'german/core')!;
const essentialsSize = essentials.conceptIds.length;
const essentialConcepts = content.concepts.filter(
  (concept): concept is LanguageConcept =>
    concept.kind === 'language' && essentials.conceptIds.includes(concept.id),
);

/** Opens the unit select box and picks the named unit of the selected Subject. */
async function pickUnit(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Change unit' }));
  await user.click(
    screen.getByRole('menuitemradio', {
      name: (accessibleName) => accessibleName.startsWith(name),
    }),
  );
}

/** The unit tile, which shows the selected unit or else the one last picked. */
function unitTile(name: string) {
  return screen.getByRole('radio', { name });
}

/** Opens the app and starts a session with every German Essentials word. */
async function startEssentialsSession(user: ReturnType<typeof userEvent.setup>) {
  render(<App />);
  await user.click(screen.getByRole('radio', { name: 'German' }));
  // At the default pace, 20 minutes fits a dictation of every word.
  await user.click(screen.getByRole('radio', { name: '20 min' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
}

/**
 * The word read aloud in a dictation exercise, or the one shown in a translation exercise. German
 * words all have a local word.
 */
function currentConcept() {
  const heading = screen.queryByRole('heading', { level: 2 });
  const concept = heading
    ? essentialConcepts.find((concept) => concept.local === heading.textContent)!
    : essentialConcepts.find((concept) => concept.foreign === spoken.at(-1))!;
  return { ...concept, local: concept.local! };
}

/** The session progress bar's value, in percent. */
function progress() {
  return Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'));
}

async function retypeAnswer(user: ReturnType<typeof userEvent.setup>) {
  const { foreign: answer } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), `${answer}{Enter}`);
}

/** The rows of the summary's word list. */
function sessionWords() {
  return within(screen.getByRole('list', { name: 'Session words' })).getAllByRole('listitem');
}

async function finishSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name: 'Finish now' }));
}

test('rates a fast exact answer as Easy and continues on Enter', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  expect(progress()).toBe(0);

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, `${currentConcept().foreign}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent('Easy');

  await user.keyboard('{Enter}');
  expect(progress()).toBeGreaterThan(0);
});

test('rates an answer with wrong capitalization as Hard and asks to retype it', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

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
  await startEssentialsSession(user);

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
  await startEssentialsSession(user);

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
  await startEssentialsSession(user);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  await retypeAnswer(user);
  await finishSession(user);

  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  // The missed word comes back soonest, so it leads the list.
  expect(sessionWords()[0]).toHaveTextContent('Learning');
  expect(screen.getByText('New words').nextSibling).toHaveTextContent('1');
  expect(screen.getByText('Repeated words').nextSibling).toHaveTextContent('0');
  expect(screen.queryByText('Review log')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'SRS details' }));
  expect(screen.getByText('Review log')).toBeInTheDocument();
});

test('typing after the answer box loses focus types into it, and Enter checks the answer', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

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
  await startEssentialsSession(user);

  const toggle = screen.getByRole('button', { name: 'Show special characters' });
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('group', { name: 'Special characters' })).toBeInTheDocument();

  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('group', { name: 'Special characters' })).not.toBeInTheDocument();
});

test('special characters keyboard inserts at the caret', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

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
  await startEssentialsSession(user);

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

// Practises every word of the German core set through the whole app, so it takes a few seconds.
test('a word moves on to translation once its dictation graduates', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  let dictations = 0;
  while (screen.queryByRole('button', { name: 'Listen' })) {
    // A fast exact answer is rated Easy, so the card graduates and leaves the session.
    await user.type(
      screen.getByRole('textbox', { name: 'Answer' }),
      `${currentConcept().foreign}{Enter}`,
    );
    await user.keyboard('{Enter}');
    dictations++;
  }
  // New words start with dictation only.
  expect(dictations).toBe(essentialsSize);
  expect(screen.getByText(/Session results/)).toBeInTheDocument();

  // Every word was practised today, so its unlocked translation only fills the room left.
  await user.click(screen.getByRole('button', { name: 'Start a new session' }));
  await user.click(screen.getByRole('radio', { name: '10 min' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  const { local, foreign } = currentConcept();
  expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(local);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();

  // The German word is read aloud only after checking the answer.
  const spokenBefore = spoken.length;
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch');
  expect(spoken).toHaveLength(spokenBefore);
  await user.keyboard('{Enter}');
  expect(spoken.slice(spokenBefore)).toEqual([foreign]);
}, 20_000);

test('finishing early asks first and stays on cancel', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  confirm.mockReturnValueOnce(false);
  await finishSession(user);
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole('textbox', { name: 'Answer' })).toBeInTheDocument();
});

test('the logo leads back to the setup screen, asking first mid-session', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  confirm.mockReturnValueOnce(false);
  await user.click(screen.getByRole('button', { name: 'Memonaut' }));
  expect(confirm).toHaveBeenCalledOnce();
  expect(screen.getByRole('textbox', { name: 'Answer' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Memonaut' }));
  expect(confirm).toHaveBeenCalledTimes(2);
  expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
});

test('the logo leads back to the setup screen from the summary without asking', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);
  await finishSession(user);
  confirm.mockClear();

  await user.click(screen.getByRole('button', { name: 'Memonaut' }));
  expect(confirm).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Start session' })).toBeInTheDocument();
});

test('Enter on a focused menu item picks it instead of checking the answer', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch');
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  screen.getByRole('menuitem', { name: 'Finish now' }).focus();
  await user.keyboard('{Enter}');
  expect(screen.getByText(/Session results/)).toBeInTheDocument();
});

test('keeps progress after a reload, even mid-session, without asking before leaving', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  await user.click(screen.getByRole('radio', { name: 'German' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));

  // A fast exact dictation is rated Easy, so the word is due again in a few days.
  await user.type(
    screen.getByRole('textbox', { name: 'Answer' }),
    `${currentConcept().foreign}{Enter}`,
  );
  await user.keyboard('{Enter}');
  const leave = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(leave);
  expect(leave.defaultPrevented).toBe(false);
  unmount();
  render(<App />);

  const tile = screen.getByRole('radio', { name: 'Essentials' }).closest('label');
  expect(tile).toHaveTextContent(`Learned0Learning1New${essentialsSize - 1}`);
  // Its translation is unlocked, but waits until the next study day.
  expect(tile).toHaveTextContent('Nothing due today');
  // Subject tiles leave due words to the set tiles.
  expect(screen.getByRole('radio', { name: 'German' }).closest('label')).not.toHaveTextContent(
    'due today',
  );
});

test('setup offers each subject with its core set selected first', async () => {
  const user = userEvent.setup();
  render(<App />);

  const subjects = screen.getByRole('group', { name: 'Subject' });
  expect(
    within(subjects)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('aria-label')),
  ).toEqual(['English', 'German', 'Matematyka', 'Polish']);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  expect(screen.getByRole('radio', { name: 'Essentials' })).toBeChecked();
  expect(unitTile('Kapitel 0')).not.toBeChecked();

  const selected = screen.getByRole('region', { name: 'Selected set' });
  expect(within(selected).getByRole('heading', { name: 'Essentials' })).toBeInTheDocument();
  expect(within(selected).getByText('Words', { selector: 'dt' }).nextSibling).toHaveTextContent(
    '46',
  );
  expect(within(selected).queryByRole('list', { name: 'Words in set' })).not.toBeInTheDocument();
});

test('picking a unit shows its stats and words, and starts a session of it', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');

  const size = content.decks.find((deck) => deck.id === 'german/kapitel-0')!.conceptIds.length;
  const selected = screen.getByRole('region', { name: 'Selected set' });
  expect(within(selected).getByText('Words', { selector: 'dt' }).nextSibling).toHaveTextContent(
    String(size),
  );
  expect(within(selected).getByText(`Exercises: ${size * 4}`)).toBeInTheDocument();

  await user.click(within(selected).getByRole('button', { name: 'Words' }));
  const words = within(selected).getByRole('list', { name: 'Words in set' });
  expect(within(words).getAllByRole('listitem')).toHaveLength(size);
  expect(words).toHaveTextContent('der Hamburger');
  expect(within(words).getAllByRole('button', { name: 'New' })).toHaveLength(size);

  await user.click(within(selected).getByRole('button', { name: 'Start session' }));
  expect(screen.getByRole('progressbar', { name: 'Kapitel 0 progress' })).toBeInTheDocument();
  // A unit starts with multiple choice.
  expect(screen.getByRole('group', { name: 'Options' })).toBeInTheDocument();
});

test('a unit unlocks recognition choice, dictation, translation choice, then translation', async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 0, 5, 10) });
  // 4 points a minute: 5 minutes fit 10 new words' recognition, at 1 point answered twice, and
  // 10 minutes their dictation, at 2 points answered twice.
  localStorage.setItem('memonaut:pace', JSON.stringify({ german: 4 }));
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');
  await user.click(screen.getByRole('radio', { name: '5 min' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  const concepts = content.concepts.filter(
    (concept): concept is LanguageConcept =>
      concept.kind === 'language' && concept.subjectId === 'german',
  );
  const options = () =>
    within(screen.getByRole('group', { name: 'Options' })).getAllByRole('button');
  // Each next exercise type unlocks on the next study day, before any new word. The minutes are
  // picked to fit just the unlocked ones.
  const startNewSession = async (now: Date, minutes: string) => {
    expect(screen.getByText(/Session results/)).toBeInTheDocument();
    vi.setSystemTime(now);
    await user.click(screen.getByRole('button', { name: 'Start a new session' }));
    await user.click(screen.getByRole('radio', { name: minutes }));
    await user.click(screen.getByRole('button', { name: 'Start session' }));
  };

  // Recognition: the German word is shown and read aloud; its meaning is picked with a number key.
  // A right pick is rated Good, so each word comes back once more before it graduates. Only the
  // first is picked really fast: it's rated Easy and graduates at once. Under a minute passes in
  // all, too short to measure the pace, so the next session is planned at the same one.
  let recognitions = 0;
  while (screen.queryByText('What does it mean?')) {
    const foreign = screen.getByRole('heading', { level: 2 }).textContent;
    expect(spoken.at(-1)).toBe(foreign);
    const { local } = concepts.find((concept) => concept.foreign === foreign)!;
    expect(options()).toHaveLength(4);
    const index = options().findIndex((option) => option.textContent?.endsWith(local!));
    if (recognitions > 0) vi.setSystemTime(Date.now() + FAST_CHOICE_MS + 1);
    await user.keyboard(String(index + 1));
    expect(screen.getByRole('status')).toHaveTextContent(recognitions === 0 ? 'Easy' : 'Good');
    expect(screen.getByRole('status')).toHaveTextContent(`${foreign}=means${local}`);
    await user.keyboard('{Enter}');
    recognitions++;
  }
  expect(recognitions).toBe(19);

  await startNewSession(new Date(2026, 0, 6, 10), '10 min');
  for (let i = 0; i < 10; i++) {
    await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${spoken.at(-1)}{Enter}`);
    await user.keyboard('{Enter}');
  }

  // Before the recognitions are due again at 10 AM.
  await startNewSession(new Date(2026, 0, 7, 5), '5 min');
  // Translation choice: a wrong pick is rated Again, and the German word is read aloud.
  expect(screen.getByText('Which word is it?')).toBeInTheDocument();
  const local = screen.getByRole('heading', { level: 2 }).textContent;
  const { foreign } = concepts.find((concept) => concept.local === local)!;
  const wrong = options().find((option) => !option.textContent?.endsWith(foreign))!;
  await user.click(wrong);
  expect(screen.getByRole('status')).toHaveTextContent('Again');
  expect(spoken.at(-1)).toBe(foreign);
  // Picking again changes nothing.
  await user.click(options().find((option) => option.textContent?.endsWith(foreign))!);
  expect(screen.getByRole('status')).toHaveTextContent('Again');
  await user.click(screen.getByRole('button', { name: /Continue/ }));
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

test('switching subject selects its core set and English has no special characters', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');
  await user.click(screen.getByRole('radio', { name: 'English' }));
  expect(screen.getByRole('radio', { name: 'Essentials' })).toBeChecked();
  // Switching back selects the core set again, but the unit picker keeps the unit last picked.
  await user.click(screen.getByRole('radio', { name: 'German' }));
  expect(screen.getByRole('radio', { name: 'Essentials' })).toBeChecked();
  expect(unitTile('Kapitel 0')).not.toBeChecked();
  // Clicking the tile, not its select box, picks that unit without opening the menu.
  await user.click(screen.getByText('Kapitel 0', { selector: 'label *' }).closest('label')!);
  expect(unitTile('Kapitel 0')).toBeChecked();
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await user.click(screen.getByRole('radio', { name: 'English' }));

  await pickUnit(user, 'Days, months and seasons');
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  expect(screen.queryByRole('button', { name: 'Show special characters' })).not.toBeInTheDocument();
});

test('the summary leads back to the setup screen with the same set selected', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');
  await user.click(screen.getByRole('button', { name: 'Start session' }));

  await finishSession(user);
  await user.click(screen.getByRole('button', { name: 'Start a new session' }));

  expect(unitTile('Kapitel 0')).toBeChecked();
});

test('words practised in a session show their status, with details on hover', async () => {
  const user = userEvent.setup();
  await startEssentialsSession(user);

  // A fast exact dictation is rated Easy and learned; the word's translation is still new.
  const { foreign } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${foreign}{Enter}`);
  await user.keyboard('{Enter}');
  await finishSession(user);
  await user.click(screen.getByRole('button', { name: 'Start a new session' }));

  await user.click(screen.getByRole('button', { name: 'Words' }));
  const words = screen.getByRole('list', { name: 'Words in set' });
  const row = within(words).getByText(foreign).closest('li')!;
  const status = within(row).getByRole('button', { name: 'Learning' });
  expect(within(words).getAllByRole('button', { name: 'New' })).toHaveLength(essentialsSize - 1);
  // The set's tile and its overview count the word as learning.
  const counts = `Learned0Learning1New${essentialsSize - 1}`;
  expect(screen.getByRole('radio', { name: 'Essentials' }).closest('label')).toHaveTextContent(
    counts,
  );
  expect(screen.getByRole('region', { name: 'Selected set' })).toHaveTextContent(counts);

  await user.hover(status);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent(/Dictation: learned, back in \d+d/);
  expect(tooltip).toHaveTextContent('Translation: not practised yet');
});

test('a session holds as many exercises as fit in the minutes chosen, 10 by default', async () => {
  const user = userEvent.setup();
  render(<App />);

  // At the default 8 points a minute, a new word's recognition takes 1 point, answered twice.
  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');
  expect(screen.getByRole('radio', { name: '10 min' })).toBeChecked();
  expect(screen.getByText('40 exercises · about 10m')).toBeInTheDocument();

  await user.click(screen.getByRole('radio', { name: '5 min' }));
  expect(screen.getByText('20 exercises · about 5m')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  await finishSession(user);
  expect(sessionWords()).toHaveLength(20);
  expect(screen.getByText('planned 5m')).toBeInTheDocument();

  // A unit with fewer words than fit takes less time.
  await user.click(screen.getByRole('button', { name: 'Start a new session' }));
  await pickUnit(user, 'Kapitel 1');
  await user.click(screen.getByRole('radio', { name: '20 min' }));
  expect(screen.getByText(/exercises · about (\d+)m/).textContent).not.toMatch(/about 20m/);
});

test('Polish practises spelling with dictation only', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('radio', { name: 'Polish' }));
  expect(unitTile('Trudne słówka')).toBeChecked();
  // At the default 8 points a minute, a new word's dictation takes 2 points, answered twice.
  await user.click(screen.getByRole('radio', { name: '5 min' }));
  await user.click(screen.getByRole('button', { name: 'Start session' }));
  expect(screen.getByRole('group', { name: 'Special characters' })).toHaveTextContent('ż');

  let dictations = 0;
  while (screen.queryByRole('button', { name: 'Listen' })) {
    await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${spoken.at(-1)}{Enter}`);
    expect(screen.getByRole('status')).toHaveTextContent('Easy');
    await user.keyboard('{Enter}');
    dictations++;
  }

  expect(dictations).toBe(10);
  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  expect(sessionWords()).toHaveLength(10);
});

test('remembers the subject, set and words per session after a reload', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);

  await user.click(screen.getByRole('radio', { name: 'German' }));
  await pickUnit(user, 'Kapitel 0');
  await user.click(screen.getByRole('radio', { name: '20 min' }));
  unmount();
  render(<App />);

  expect(screen.getByRole('radio', { name: 'German' })).toBeChecked();
  expect(unitTile('Kapitel 0')).toBeChecked();
  expect(screen.getByRole('radio', { name: '20 min' })).toBeChecked();
});

test('the effort stats show with dev=1 in the URL, with each finished session logged', async () => {
  const user = userEvent.setup();
  const { unmount } = render(<App />);
  expect(screen.queryByRole('region', { name: 'Effort stats' })).not.toBeInTheDocument();
  unmount();

  window.history.pushState({}, '', '/?dev=1');
  try {
    render(<App />);
    expect(screen.getByRole('button', { name: /Effort stats/ })).toHaveTextContent(
      '0 sessions logged',
    );

    await user.click(screen.getByRole('radio', { name: 'German' }));
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    for (let i = 0; i < 2; i++) {
      await user.type(
        screen.getByRole('textbox', { name: 'Answer' }),
        `${currentConcept().foreign}{Enter}`,
      );
      await user.keyboard('{Enter}');
    }
    await finishSession(user);
    await user.click(screen.getByRole('button', { name: 'Start a new session' }));

    const toggle = screen.getByRole('button', { name: /Effort stats/ });
    expect(toggle).toHaveTextContent('1 session logged');
    await user.click(toggle);
    expect(screen.getByRole('table', { name: 'Exercise types' })).toHaveTextContent('Dictation');
    expect(screen.getByRole('table', { name: 'Sessions' })).toHaveTextContent('german/core');
  } finally {
    window.history.pushState({}, '', '/');
  }
});

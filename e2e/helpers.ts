import { expect, type Page } from '@playwright/test';

/**
 * A knowledge Subject's set of one question, without intros, so a session asks it right away and
 * the tests don't depend on the bundled word sets.
 */
export const QUIZ_SET = `
id: sums
name: Sums
showIntro: false
concepts:
  - { id: two-plus-two, question: '2 + 2 =', answer: '4' }
`;

/** Confirms every `window.confirm`, e.g. before importing progress. */
export function acceptDialogs(page: Page) {
  page.on('dialog', (dialog) => void dialog.accept());
}

export async function openMenuItem(page: Page, name: string) {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('menuitem', { name }).click();
}

/** Adds a Subject of the user's under My sets and imports a set into it. */
export async function addSubjectWithSet(page: Page, name: string, setYaml: string) {
  await openMenuItem(page, 'My sets');
  const dialog = page.getByRole('dialog', { name: 'My sets' });
  await dialog.getByLabel('New subject').fill(name);
  await dialog.getByLabel('Kind').selectOption('knowledge');
  await dialog.getByRole('button', { name: 'Add subject' }).click();
  await expect(dialog.getByLabel('Subject', { exact: true })).toHaveValue(/./);
  await dialog.getByLabel('Set file').setInputFiles({
    name: 'set.yaml',
    mimeType: 'application/yaml',
    buffer: Buffer.from(setYaml),
  });
  await expect(dialog.getByRole('status')).toContainText(`in ${name}.`);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
}

/** Picks a Subject on the setup screen; its radio is visually hidden behind the tile. */
export async function pickSubject(page: Page, name: string) {
  await page.getByRole('radio', { name }).check({ force: true });
}

/** Studies a session of `QUIZ_SET` to its end, answering right each time it's asked. */
export async function studyQuiz(page: Page) {
  await page.getByRole('button', { name: 'Start session' }).click();
  const answer = page.getByRole('textbox', { name: 'Answer' });
  const newSession = page.getByRole('button', { name: 'Start a new session' });
  // A new Card comes back in the same session until it's learned for today.
  for (let tries = 0; tries < 5 && !(await newSession.isVisible()); tries++) {
    await answer.fill('4');
    await answer.press('Enter');
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(answer.or(newSession)).toBeVisible();
  }
  await expect(newSession).toBeVisible();
}

/** The setup screen lists the question as practised, no longer new. */
export async function expectQuestionPractised(page: Page) {
  await page.getByRole('button', { name: 'Questions', exact: true }).click();
  const list = page.getByRole('list', { name: 'Questions in set' });
  await expect(list.getByRole('listitem')).toHaveCount(1);
  await expect(list.getByLabel('New', { exact: true })).toHaveCount(0);
}

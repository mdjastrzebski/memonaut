import { expect, test } from '@playwright/test';

import {
  acceptDialogs,
  addSubjectWithSet,
  expectQuestionPractised,
  openMenuItem,
  pickSubject,
  QUIZ_SET,
  studyQuiz,
} from './helpers';

test.beforeEach(({ page }) => acceptDialogs(page));

test('the bundled sets load and a session starts and finishes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');

  await page.getByRole('button', { name: 'Start session' }).click();
  await openMenuItem(page, 'Finish now');

  await expect(page.getByRole('button', { name: 'Start a new session' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('an imported set is studied and its progress is kept after a reload', async ({ page }) => {
  await page.goto('/');
  await addSubjectWithSet(page, 'Quiz', QUIZ_SET);
  await pickSubject(page, 'Quiz');

  await studyQuiz(page);
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Sums' })).toBeVisible();
  await expectQuestionPractised(page);
});

test('exported progress, with the own sets, moves to a fresh device', async ({ page, browser }) => {
  await page.goto('/');
  await addSubjectWithSet(page, 'Quiz', QUIZ_SET);
  await pickSubject(page, 'Quiz');
  await studyQuiz(page);
  await page.getByRole('button', { name: 'Start a new session' }).click();
  const download = page.waitForEvent('download');
  await openMenuItem(page, 'Export progress');
  const backup = await (await download).path();

  // Another browser context has empty storage, like another device.
  const device = await browser.newContext({ reducedMotion: 'reduce' });
  const fresh = await device.newPage();
  acceptDialogs(fresh);
  await fresh.goto('/');
  await expect(fresh.getByRole('radio', { name: 'Quiz' })).toHaveCount(0);
  await fresh.getByLabel('Progress file').setInputFiles(backup);
  await fresh.waitForURL('/');

  await pickSubject(fresh, 'Quiz');
  await expectQuestionPractised(fresh);
  await device.close();
});

test('the setup screen and My sets fit a phone without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await openMenuItem(page, 'My sets');
  await expect(page.getByRole('dialog', { name: 'My sets' })).toBeVisible();
  expect(await overflow()).toBeLessThanOrEqual(0);
});

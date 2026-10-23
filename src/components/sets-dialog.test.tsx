import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import App from '@/App';

const confirm = vi.fn(() => true);

beforeEach(() => {
  confirm.mockClear();
  vi.stubGlobal('confirm', confirm);
});

afterEach(() => vi.unstubAllGlobals());

const yamlFile = (text: string) => new File([text], 'set.yaml', { type: 'application/yaml' });

const FOOD = `
id: food
name: Food
concepts:
  - { id: bread, local: chleb, foreign: le pain }
`;

async function openSets(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name: 'My sets' }));
  return screen.getByRole('dialog');
}

test('adds a subject of its own and imports a set into it, which shows up to study', async () => {
  const user = userEvent.setup();
  render(<App />);
  const dialog = await openSets(user);

  await user.type(within(dialog).getByLabelText('New subject'), 'French');
  await user.selectOptions(within(dialog).getByLabelText('Read aloud in'), 'fr-FR');
  await user.click(within(dialog).getByRole('button', { name: 'Add subject' }));
  expect(within(dialog).getByText('Words, read aloud in French')).toBeInTheDocument();
  expect(within(dialog).getByLabelText('Subject')).toHaveValue('french');

  await user.upload(within(dialog).getByLabelText('Set file'), yamlFile(FOOD));
  expect(await within(dialog).findByRole('status')).toHaveTextContent('Added Food in French.');
  expect(within(dialog).getByText('Food')).toBeInTheDocument();

  await user.keyboard('{Escape}');
  expect(screen.getByRole('radio', { name: /French/ })).toBeInTheDocument();
});

test('asks before replacing a set with a new version, and reports one that does not load', async () => {
  const user = userEvent.setup();
  render(<App />);
  const dialog = await openSets(user);
  await user.selectOptions(within(dialog).getByLabelText('Subject'), 'english');
  await user.upload(within(dialog).getByLabelText('Set file'), yamlFile(FOOD));
  await within(dialog).findByText('Added Food in English.');
  expect(confirm).not.toHaveBeenCalled();

  await user.upload(within(dialog).getByLabelText('Set file'), yamlFile(FOOD));
  expect(await within(dialog).findByText('Updated Food in English.')).toBeInTheDocument();
  expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/^Replace Food in English/));

  await user.upload(
    within(dialog).getByLabelText('Set file'),
    yamlFile('id: food\nname: Food\nconcepts: [{ id: bread, foreign: bread }]'),
  );
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('needs a local word');
});

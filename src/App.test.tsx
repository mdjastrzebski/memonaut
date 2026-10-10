import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import App from './App';
import { germanNumberConcepts } from './data/german-numbers';

function currentConcept() {
  const prompt = screen.getByText('Type in German').nextElementSibling?.textContent;
  return germanNumberConcepts.find((concept) => concept.prompt === prompt)!;
}

test('practises a word and shows SRS stats', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole('region', { name: 'SRS details' })).toBeInTheDocument();
  expect(screen.getByText('Reviews: 0')).toBeInTheDocument();

  await user.type(
    screen.getByRole('textbox', { name: 'Answer' }),
    `${currentConcept().answer}{Enter}`,
  );
  expect(screen.getByRole('status')).toHaveTextContent('Correct!');

  await user.click(screen.getByRole('button', { name: /Good/ }));
  expect(screen.getByText('Reviews: 1')).toBeInTheDocument();
});

test('wrong answer can only be rated Again', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Not quite');
  expect(screen.getByRole('button', { name: /Again/ })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Good/ })).not.toBeInTheDocument();
});

test('ending the session shows results', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'End session' }));
  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  expect(screen.getByText('Review log')).toBeInTheDocument();
});

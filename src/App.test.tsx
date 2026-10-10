import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import App from './App';
import { germanNumberConcepts } from './data/german-numbers';

function currentConcept() {
  const prompt = screen.getByText('Type in German').nextElementSibling?.textContent;
  return germanNumberConcepts.find((concept) => concept.prompt === prompt)!;
}

test('rates a fast exact answer as Easy and continues on Enter', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByRole('region', { name: 'SRS details' })).toBeInTheDocument();
  expect(screen.getByText('Reviews: 0')).toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, `${currentConcept().answer}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent('Correct and fast!');
  expect(screen.getByRole('status')).toHaveTextContent('Rated Easy');

  await user.keyboard('{Enter}');
  expect(screen.getByText('Reviews: 1')).toBeInTheDocument();
});

test('rates an answer with wrong capitalization as Hard', async () => {
  const user = userEvent.setup();
  render(<App />);

  const { answer } = currentConcept();
  const capitalized = answer[0].toUpperCase() + answer.slice(1);
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${capitalized}{Enter}`);

  expect(screen.getByRole('status')).toHaveTextContent('Almost! Check: capital letters.');
  expect(screen.getByRole('status')).toHaveTextContent(`The answer is ${answer}.`);
  expect(screen.getByRole('status')).toHaveTextContent('Rated Hard');
});

test('rates a wrong answer as Again without asking', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  expect(screen.getByRole('status')).toHaveTextContent('Not quite.');
  expect(screen.getByRole('status')).toHaveTextContent('Rated Again');
  expect(screen.queryByRole('button', { name: /^(Hard|Good|Easy)/ })).not.toBeInTheDocument();
});

test('ending the session shows results', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'End session' }));
  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  expect(screen.getByText('Review log')).toBeInTheDocument();
});

test('special characters keyboard inserts at the caret', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.queryByRole('group', { name: 'Special characters' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show special characters' }));
  const keyboard = screen.getByRole('group', { name: 'Special characters' });

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, 'fnf');
  await user.keyboard('{ArrowLeft}{ArrowLeft}');
  await user.click(within(keyboard).getByRole('button', { name: 'ü' }));
  await user.keyboard('x');

  expect(input).toHaveValue('füxnf');
  expect(input).toHaveFocus();
});

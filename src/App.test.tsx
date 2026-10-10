import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import App from './App';
import { germanNumberConcepts } from './data/german-numbers';

function currentConcept() {
  const prompt = screen.getByRole('heading', { level: 2 }).textContent;
  return germanNumberConcepts.find((concept) => concept.prompt === prompt)!;
}

test('rates a fast exact answer as Easy and continues on Enter', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText(/0 answers/)).toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, `${currentConcept().answer}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent('Correct and fast!');
  expect(screen.getByRole('status')).toHaveTextContent('Rated Easy');

  await user.keyboard('{Enter}');
  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
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

test('SRS details start collapsed and stay expanded across exercises', async () => {
  const user = userEvent.setup();
  render(<App />);

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
  await user.keyboard('{Enter}');

  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
  expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Rating preview')).toBeInTheDocument();
});

test('ending the session shows results with SRS details collapsed', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  await user.keyboard('{Enter}');
  await user.click(screen.getByRole('button', { name: 'End session' }));

  expect(screen.getByText(/Session results/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Keep practising' })).toBeInTheDocument();
  expect(screen.queryByText('Review log')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'SRS details' }));
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

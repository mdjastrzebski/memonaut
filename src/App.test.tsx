import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import App from './App';
import { content } from './data/content';

function currentConcept() {
  const local = screen.getByRole('heading', { level: 2 }).textContent;
  return content.concepts.find((concept) => concept.local === local)!;
}

async function retypeAnswer(user: ReturnType<typeof userEvent.setup>) {
  const { foreign: answer } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), `${answer}{Enter}`);
}

test('rates a fast exact answer as Easy and continues on Enter', async () => {
  const user = userEvent.setup();
  render(<App />);

  expect(screen.getByText(/0 answers/)).toBeInTheDocument();

  const input = screen.getByRole('textbox', { name: 'Answer' });
  await user.type(input, `${currentConcept().foreign}{Enter}`);
  expect(screen.getByRole('status')).toHaveTextContent('Correct and fast!');
  expect(screen.getByRole('status')).toHaveTextContent('Rated Easy');

  await user.keyboard('{Enter}');
  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
});

test('rates an answer with wrong capitalization as Hard and asks to retype it', async () => {
  const user = userEvent.setup();
  render(<App />);

  const { foreign: answer } = currentConcept();
  const capitalized = answer[0].toUpperCase() + answer.slice(1);
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), `${capitalized}{Enter}`);

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Almost! Check: capital letters.');
  expect(status).toHaveTextContent('Rated Hard');
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
  expect(screen.getByText(/0 answers/)).toBeInTheDocument();

  await user.clear(retype);
  await user.type(retype, `${answer}{Enter}`);
  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
});

test('rates a wrong answer as Again and shows it next to the answer', async () => {
  const user = userEvent.setup();
  render(<App />);

  const { foreign: answer } = currentConcept();
  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');

  const status = screen.getByRole('status');
  expect(status).toHaveTextContent('Not quite.');
  expect(status).toHaveTextContent('You typedfalsch');
  expect(status).toHaveTextContent(`Answer${answer}`);
  expect(status).toHaveTextContent('Rated Again');
  expect(within(status).queryAllByText(/./, { selector: 'mark' })).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /^(Hard|Good|Easy)/ })).not.toBeInTheDocument();

  await user.type(screen.getByRole('textbox', { name: 'Retype answer' }), `${answer}{Enter}`);
  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
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
  await retypeAnswer(user);

  expect(screen.getByText(/1 answer$/)).toBeInTheDocument();
  expect(toggle()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Rating preview')).toBeInTheDocument();
});

test('ending the session shows results with SRS details collapsed', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.type(screen.getByRole('textbox', { name: 'Answer' }), 'falsch{Enter}');
  await retypeAnswer(user);
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

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import type { Card } from '@/domain/types';
import { createSrsCard, State } from '@/srs/scheduler';
import { testContent } from '@/test/content';

import { ProgressScreen } from './progress-screen';

const now = new Date(2026, 9, 17, 12);

test('shows the cards of each exercise in the chosen set', async () => {
  const user = userEvent.setup();
  const card: Card = {
    id: 'english/red:translation',
    conceptId: 'english/red',
    exerciseType: 'translation',
    srs: { ...createSrsCard(now), state: State.Review },
  };
  render(
    <TooltipProvider>
      <ProgressScreen
        content={testContent}
        cards={{ [card.id]: card }}
        onSelectDeck={() => {}}
        sessions={[]}
        now={now}
      />
    </TooltipProvider>,
  );

  const deck = testContent.decks[0];
  const list = screen.getByRole('list', { name: `Exercises in ${deck.name}` });
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.getAttribute('aria-label')),
  ).toEqual([
    'Recognition: 4 cards, 25%',
    'Translation choice: 4 cards, 25%',
    'Dictation: 4 cards, 25%',
    'Translation: 4 cards, 25%',
  ]);

  const kapitel = testContent.decks.find((deck) => deck.id === 'german/kapitel-1')!;
  await user.selectOptions(screen.getByLabelText('Set'), kapitel.id);
  const kapitelList = screen.getByRole('list', { name: `Exercises in ${kapitel.name}` });
  expect(
    within(kapitelList).getByRole('listitem', { name: /^Cloze: 2 cards/ }),
  ).toBeInTheDocument();
});

test("shows a set's words with each exercise's next review and difficulty", async () => {
  const user = userEvent.setup();
  const deck = testContent.decks[0];
  const review = (conceptId: string, difficulty: number, dueInDays: number): Card => ({
    id: `${conceptId}:translation`,
    conceptId,
    exerciseType: 'translation',
    srs: {
      ...createSrsCard(now),
      state: State.Review,
      difficulty,
      stability: 10,
      reps: 3,
      last_review: now,
      due: new Date(now.getTime() + dueInDays * 86_400_000),
    },
  });
  const cards = [review('english/monday', 3, 5), review('english/tuesday', 8, -1)];
  render(
    <TooltipProvider>
      <ProgressScreen
        content={testContent}
        cards={Object.fromEntries(cards.map((card) => [card.id, card]))}
        onSelectDeck={() => {}}
        sessions={[]}
        now={now}
      />
    </TooltipProvider>,
  );

  await user.click(screen.getByRole('button', { name: /Words by exercise/ }));
  const table = screen.getByRole('table', { name: `Words in ${deck.name}` });
  const translations = () =>
    within(table)
      .getAllByRole('row')
      .slice(2)
      .map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      )
      .map((cells) => [cells[0], ...cells.slice(-2)]);
  expect(translations()).toEqual([
    ['Mondayponiedziałek', '5d', '3'],
    ['Tuesdaywtorek', 'due', '8'],
    ['Wednesdayśroda', 'new', ''],
    ['Thursdayczwartek', 'new', ''],
  ]);

  await user.click(within(table).getByRole('button', { name: 'Translation: Difficulty' }));
  expect(translations().map(([word]) => word)).toEqual([
    'Tuesdaywtorek',
    'Mondayponiedziałek',
    'Wednesdayśroda',
    'Thursdayczwartek',
  ]);
});

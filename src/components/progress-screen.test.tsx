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

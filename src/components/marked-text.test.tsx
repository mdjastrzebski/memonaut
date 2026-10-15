import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';

import { MarkedText } from './marked-text';

test('highlights the marked parts', () => {
  render(<MarkedText text="die Kuli[s]" />);
  expect(screen.getByText('s', { selector: 'mark' })).toBeInTheDocument();
  expect(screen.getByText('die Kuli')).toBeInTheDocument();
});

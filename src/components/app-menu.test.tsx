import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test } from 'vitest';

import { AppMenu } from './app-menu';

async function openVoiceSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name: /Better voice/ }));
}

test('offers finishing early only during a session', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<AppMenu />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  expect(screen.queryByRole('menuitem', { name: 'Finish now' })).not.toBeInTheDocument();

  await user.keyboard('{Escape}');
  rerender(<AppMenu onEnd={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  expect(screen.getByRole('menuitem', { name: 'Finish now' })).toBeInTheDocument();
});

test('saves and removes the ElevenLabs key without showing it back', async () => {
  const user = userEvent.setup();
  render(<AppMenu />);

  await openVoiceSettings(user);
  expect(screen.getByText(/^Off:/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('API key'), 'secret-key');
  await user.click(screen.getByRole('button', { name: 'Save key' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBe('secret-key');

  await openVoiceSettings(user);
  expect(screen.getByText(/^On:/)).toBeInTheDocument();
  expect(screen.getByLabelText('New API key')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Remove key' }));
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBeNull();
});

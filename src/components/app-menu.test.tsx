import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, test, vi } from 'vitest';

import { AppMenu } from './app-menu';

async function openVoiceSettings(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(screen.getByRole('menuitem', { name }));
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

test('saves, switches off and removes the ElevenLabs key without showing it back', async () => {
  const user = userEvent.setup();
  render(<AppMenu />);

  await openVoiceSettings(user, 'TTS: Browser');
  expect(screen.getByText(/^Off:/)).toBeInTheDocument();
  await user.type(screen.getByLabelText('API key'), 'secret-key');
  await user.click(screen.getByRole('button', { name: 'Save key' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBe('secret-key');

  await openVoiceSettings(user, 'TTS: ElevenLabs');
  expect(screen.getByText(/^On:/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Browser' }));
  expect(screen.getByRole('button', { name: 'Browser' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText(/stays saved/)).toBeInTheDocument();
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBe('secret-key');
  await user.click(screen.getByRole('button', { name: 'ElevenLabs' }));
  expect(screen.getByText(/^On:/)).toBeInTheDocument();
  expect(screen.getByLabelText('New API key')).toHaveValue('');
  await user.click(screen.getByRole('button', { name: 'Remove key' }));
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBeNull();
});

test('imports progress from a file only outside a session', async () => {
  const user = userEvent.setup();
  const confirm = vi.fn(() => true);
  const reload = vi.fn();
  vi.stubGlobal('confirm', confirm);
  vi.stubGlobal('location', { ...window.location, reload });
  const { rerender } = render(<AppMenu onEnd={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  expect(screen.getByRole('menuitem', { name: 'Export progress' })).toBeInTheDocument();
  expect(screen.queryByRole('menuitem', { name: 'Import progress' })).not.toBeInTheDocument();

  await user.keyboard('{Escape}');
  rerender(<AppMenu />);
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  expect(screen.getByRole('menuitem', { name: 'Import progress' })).toBeInTheDocument();
  await user.keyboard('{Escape}');

  const backup = { app: 'memonaut', version: 1, data: { 'memonaut:pace': '{"german":7}' } };
  await user.upload(
    screen.getByLabelText('Progress file'),
    new File([JSON.stringify(backup)], 'memonaut-progress.json', { type: 'application/json' }),
  );
  await waitFor(() => expect(reload).toHaveBeenCalled());
  expect(confirm).toHaveBeenCalled();
  expect(localStorage.getItem('memonaut:pace')).toBe('{"german":7}');
  vi.unstubAllGlobals();
});

test('picks a browser voice per language, kept on this device', async () => {
  const user = userEvent.setup();
  const spoken: { text: string; voice?: { name: string } }[] = [];
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string;
      lang = '';
      constructor(text: string) {
        this.text = text;
      }
    },
  );
  vi.stubGlobal('speechSynthesis', {
    speaking: false,
    pending: false,
    getVoices: () => [
      { name: 'Anna', lang: 'de-DE', localService: true, voiceURI: 'anna' },
      { name: 'Eddy', lang: 'de-DE', localService: true, voiceURI: 'eddy' },
    ],
    addEventListener: () => {},
    removeEventListener: () => {},
    speak: (utterance: { text: string; voice?: { name: string } }) => spoken.push(utterance),
  });
  render(<AppMenu />);

  await openVoiceSettings(user, 'TTS: Browser');
  const german = screen.getByRole('combobox', { name: /German/ });
  expect(german).toHaveValue('');
  await user.selectOptions(german, 'eddy');
  expect(german).toHaveValue('eddy');
  expect(JSON.parse(localStorage.getItem('memonaut:browser-voices')!)).toEqual({ 'de-DE': 'eddy' });

  await user.click(screen.getByRole('button', { name: 'Try the German voice' }));
  expect(spoken.at(-1)?.voice?.name).toBe('Eddy');
  vi.unstubAllGlobals();
});

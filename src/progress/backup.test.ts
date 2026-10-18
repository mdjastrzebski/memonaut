import { expect, test } from 'vitest';

import { createBackup, getBackupFileName, restoreBackup } from './backup';

const now = new Date('2026-10-18T12:00:00Z');

test('backs up stored values, but not the ElevenLabs key or the theme', () => {
  localStorage.setItem('memonaut:progress:german', '{"version":1,"words":{}}');
  localStorage.setItem('memonaut:pace', '{"german":7.4}');
  localStorage.setItem('memonaut:elevenlabs-key', 'secret-key');
  localStorage.setItem('memonaut:theme', 'dark');
  localStorage.setItem('other-app', 'x');

  expect(JSON.parse(createBackup(now))).toEqual({
    app: 'memonaut',
    version: 1,
    exportedAt: '2026-10-18T12:00:00.000Z',
    data: {
      'memonaut:progress:german': '{"version":1,"words":{}}',
      'memonaut:pace': '{"german":7.4}',
    },
  });
  expect(getBackupFileName(now)).toBe('memonaut-progress-2026-10-18.json');
});

test('restoring replaces stored values with the backup, keeping the key and the theme', () => {
  localStorage.setItem('memonaut:progress:german', 'old');
  const backup = createBackup(now);

  localStorage.setItem('memonaut:progress:german', 'newer');
  localStorage.setItem('memonaut:progress:english', 'newer');
  localStorage.setItem('memonaut:elevenlabs-key', 'secret-key');
  localStorage.setItem('memonaut:theme', 'dark');

  expect(restoreBackup(backup)).toBe(true);
  expect(localStorage.getItem('memonaut:progress:german')).toBe('old');
  expect(localStorage.getItem('memonaut:progress:english')).toBeNull();
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBe('secret-key');
  expect(localStorage.getItem('memonaut:theme')).toBe('dark');
});

test('restores only Memonaut values, never the ElevenLabs key', () => {
  const backup = JSON.stringify({
    app: 'memonaut',
    version: 1,
    data: { 'memonaut:pace': '{}', 'memonaut:elevenlabs-key': 'planted', 'other-app': 'x' },
  });
  expect(restoreBackup(backup)).toBe(true);
  expect(localStorage.getItem('memonaut:pace')).toBe('{}');
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBeNull();
  expect(localStorage.getItem('other-app')).toBeNull();
});

test('changes nothing for a file that is not a readable backup', () => {
  localStorage.setItem('memonaut:pace', 'kept');
  for (const text of [
    '{oops',
    '{"app":"other","version":1,"data":{}}',
    '{"app":"memonaut","version":2,"data":{}}',
    '{"app":"memonaut","version":1,"data":{"memonaut:pace":3}}',
  ]) {
    expect(restoreBackup(text)).toBe(false);
  }
  expect(localStorage.getItem('memonaut:pace')).toBe('kept');
});

import { expect, test } from 'vitest';

import { createBackup, getBackupFileName, importBackup } from './backup';

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

const backupOf = (data: Record<string, unknown>) =>
  JSON.stringify({
    app: 'memonaut',
    version: 1,
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, JSON.stringify(value)]),
    ),
  });
const stored = (key: string) => JSON.parse(localStorage.getItem(key)!);

test('importing keeps the later repetition of each word and exercise type', () => {
  localStorage.setItem(
    'memonaut:progress:german',
    JSON.stringify({
      version: 1,
      words: {
        eins: { dictation: { d: 50, lr: 10 }, spelling: { d: 90, lr: 30 } },
        zwei: { dictation: { d: 60, lr: 20 } },
      },
    }),
  );
  const backup = backupOf({
    'memonaut:progress:german': {
      version: 1,
      words: {
        eins: { dictation: { d: 70, lr: 15, extra: 'kept' }, spelling: { d: 80, lr: 25 } },
        drei: { dictation: { d: 40, lr: 5 } },
      },
    },
    'memonaut:progress:english': { version: 1, words: { one: { dictation: { d: 1 } } } },
  });

  expect(importBackup(backup)).toBe(true);
  expect(stored('memonaut:progress:german')).toEqual({
    version: 1,
    words: {
      eins: { dictation: { d: 70, lr: 15, extra: 'kept' }, spelling: { d: 90, lr: 30 } },
      zwei: { dictation: { d: 60, lr: 20 } },
      drei: { dictation: { d: 40, lr: 5 } },
    },
  });
  expect(stored('memonaut:progress:english').words.one).toEqual({ dictation: { d: 1 } });
});

test("importing keeps the sessions of both, and this device's other values", () => {
  const session = (startedAt: string, activeMs: number) => ({ startedAt, activeMs, xp: 1 });
  localStorage.setItem(
    'memonaut:sessions',
    JSON.stringify({
      version: 1,
      sessions: [session('2026-10-02T10:00:00.000Z', 60), session('2026-10-03T10:00:00.000Z', 30)],
    }),
  );
  localStorage.setItem('memonaut:pace', '{"german":7}');
  localStorage.setItem('memonaut:elevenlabs-key', 'secret-key');
  const backup = backupOf({
    'memonaut:sessions': {
      version: 1,
      sessions: [session('2026-10-01T10:00:00.000Z', 10), session('2026-10-03T10:00:00.000Z', 90)],
    },
    'memonaut:pace': { german: 9 },
    'memonaut:setup': { deckId: 'numbers' },
  });

  expect(importBackup(backup)).toBe(true);
  expect(stored('memonaut:sessions').sessions).toEqual([
    session('2026-10-01T10:00:00.000Z', 10),
    session('2026-10-02T10:00:00.000Z', 60),
    session('2026-10-03T10:00:00.000Z', 90),
  ]);
  expect(stored('memonaut:pace')).toEqual({ german: 7 });
  expect(stored('memonaut:setup')).toEqual({ deckId: 'numbers' });
  expect(localStorage.getItem('memonaut:elevenlabs-key')).toBe('secret-key');
});

test("importing keeps this device's progress when the backup's is from a newer version", () => {
  const local = JSON.stringify({ version: 1, words: { eins: { dictation: { d: 1, lr: 1 } } } });
  localStorage.setItem('memonaut:progress:german', local);
  const backup = backupOf({
    'memonaut:progress:german': { version: 2, words: { eins: { dictation: { d: 9, lr: 9 } } } },
  });
  expect(importBackup(backup)).toBe(true);
  expect(localStorage.getItem('memonaut:progress:german')).toBe(local);
});

test('imports only Memonaut values, never the ElevenLabs key', () => {
  const backup = JSON.stringify({
    app: 'memonaut',
    version: 1,
    data: { 'memonaut:pace': '{}', 'memonaut:elevenlabs-key': 'planted', 'other-app': 'x' },
  });
  expect(importBackup(backup)).toBe(true);
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
    expect(importBackup(text)).toBe(false);
  }
  expect(localStorage.getItem('memonaut:pace')).toBe('kept');
});

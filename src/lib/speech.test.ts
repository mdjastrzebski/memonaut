import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import {
  findVoice,
  getNormalizingGain,
  getVoiceStatus,
  HINT_DELAY_MS,
  removeElevenLabsKey,
  saveElevenLabsKey,
  speak,
  stopHint,
} from './speech';

interface FakeUtterance {
  text: string;
  voice?: { name: string };
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
}

/** The browser's voices, as `getVoices()` returns them. */
let voices: Partial<SpeechSynthesisVoice>[] = [];

const queue: FakeUtterance[] = [];
const spoken: string[] = [];
const played: { gain: number; onended: (() => void) | null }[] = [];

/** A decoded one-channel clip of `seconds`, at a steady `level`. */
function fakeBuffer(level: number, seconds = 0.5) {
  const sampleRate = 8000;
  const samples = new Float32Array(sampleRate * seconds).fill(level);
  return {
    sampleRate,
    length: samples.length,
    numberOfChannels: 1,
    getChannelData: () => samples,
  } as unknown as AudioBuffer;
}

/** Plays nothing; records each clip started and the gain it was given. */
class FakeAudioContext {
  state = 'running';
  destination = {};
  resume = () => Promise.resolve();
  decodeAudioData = () => Promise.resolve(fakeBuffer(0.05));
  createDynamicsCompressor() {
    const param = () => ({ value: 0 });
    return {
      threshold: param(),
      knee: param(),
      ratio: param(),
      attack: param(),
      release: param(),
      connect: () => {},
    };
  }
  createGain() {
    return { gain: { value: 1 }, connect: (node: unknown) => node };
  }
  createBufferSource() {
    let gainNode: { gain: { value: number } };
    const source = {
      buffer: null,
      onended: null as (() => void) | null,
      connect: (node: { gain: { value: number } }) => (gainNode = node),
      start: () => played.push({ gain: gainNode.gain.value, onended: source.onended }),
      stop: () => {},
    };
    return source;
  }
}
const fetchMock = vi.fn<typeof fetch>();

/** Finishes reading the first word in the queue. */
function finishReading() {
  queue.shift()?.onend?.();
}

beforeEach(() => {
  queue.length = 0;
  spoken.length = 0;
  played.length = 0;
  voices = [];
  fetchMock.mockReset();
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
    get speaking() {
      return queue.length > 0;
    },
    pending: false,
    getVoices: () => voices,
    speak: (utterance: FakeUtterance) => {
      queue.push(utterance);
      spoken.push(utterance.text);
    },
  });
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  stopHint();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function audioResponse() {
  return new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
}

test('does not queue a word again while it is still being read', () => {
  speak('drei', 'de-DE');
  speak('drei', 'de-DE');
  expect(spoken).toEqual(['drei']);
});

test('queues a different word, or the same one once reading has finished', () => {
  speak('drei', 'de-DE');
  speak('vier', 'de-DE');
  expect(spoken).toEqual(['drei', 'vier']);

  queue.length = 0;
  spoken.length = 0;
  speak('vier', 'de-DE');
  expect(spoken).toEqual(['vier']);
});

test('reads the hint a moment after the word', () => {
  vi.useFakeTimers();
  speak('morze', 'pl-PL', 'zbiornik słonej wody');
  expect(spoken).toEqual(['morze']);

  finishReading();
  vi.advanceTimersByTime(HINT_DELAY_MS - 1);
  expect(spoken).toEqual(['morze']);
  vi.advanceTimersByTime(1);
  expect(spoken).toEqual(['morze', 'zbiornik słonej wody']);
});

test('skips the hint once another word is queued or the hint is stopped', () => {
  vi.useFakeTimers();
  speak('morze', 'pl-PL', 'zbiornik słonej wody');
  speak('może', 'pl-PL', 'przypuszczenie');
  finishReading();
  vi.runAllTimers();
  expect(spoken).toEqual(['morze', 'może']);

  // The second word's hint still follows it.
  finishReading();
  vi.runAllTimers();
  expect(spoken).toEqual(['morze', 'może', 'przypuszczenie']);

  queue.length = 0;
  spoken.length = 0;
  speak('morze', 'pl-PL', 'zbiornik słonej wody');
  finishReading();
  stopHint();
  vi.runAllTimers();
  expect(spoken).toEqual(['morze']);
});

test('uses the browser voice until an ElevenLabs key is saved', () => {
  expect(getVoiceStatus()).toBe('off');
  saveElevenLabsKey('  key-1  ');
  expect(getVoiceStatus()).toBe('on');
  removeElevenLabsKey();
  expect(getVoiceStatus()).toBe('off');
});

test('reads words with ElevenLabs in the German voice and reuses the audio', async () => {
  saveElevenLabsKey('key-2');
  fetchMock.mockResolvedValue(audioResponse());

  speak('Hund', 'de-DE');
  await vi.waitFor(() => expect(played).toHaveLength(1));

  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/TX3LPaxmHKxFdv7VOQHJ');
  expect(init?.headers).toMatchObject({ 'xi-api-key': 'key-2' });
  expect(JSON.parse(init?.body as string)).toMatchObject({
    text: 'Hund',
    language_code: 'de',
    previous_text: 'Das nächste Wort ist auf Deutsch.',
  });

  // A replay while the word is still playing is ignored, one after it reuses the audio.
  speak('Hund', 'de-DE');
  played[0].onended?.();
  speak('Hund', 'de-DE');
  await vi.waitFor(() => expect(played).toHaveLength(2));
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(spoken).toEqual([]);
});

test('turns quiet ElevenLabs audio up to the loudness of browser voices', async () => {
  saveElevenLabsKey('key-6');
  fetchMock.mockResolvedValue(audioResponse());

  speak('Baum', 'de-DE');
  await vi.waitFor(() => expect(played).toHaveLength(1));
  expect(played[0].gain).toBeCloseTo(4);
});

test('measures loudness only where the voice speaks, up to a limit', () => {
  const quietSpeech = fakeBuffer(0.1, 1);
  // The second half is silence, which must not make the word seem quieter.
  quietSpeech.getChannelData(0).fill(0, 4000);
  expect(getNormalizingGain(quietSpeech)).toBeCloseTo(2);
  expect(getNormalizingGain(fakeBuffer(0.4))).toBeCloseTo(0.5);
  expect(getNormalizingGain(fakeBuffer(0.011))).toBe(8);
  expect(getNormalizingGain(fakeBuffer(0))).toBe(1);
});

test('falls back to the browser voice when ElevenLabs is unreachable', async () => {
  saveElevenLabsKey('key-3');
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

  speak('Katze', 'de-DE');
  await vi.waitFor(() => expect(spoken).toEqual(['Katze']));
  expect(getVoiceStatus()).toBe('on');
});

test('pauses ElevenLabs when the key is rejected, until a key is saved again', async () => {
  saveElevenLabsKey('key-4');
  fetchMock.mockResolvedValue(new Response('Unauthorized', { status: 401 }));

  speak('Maus', 'de-DE');
  await vi.waitFor(() => expect(spoken).toEqual(['Maus']));
  expect(getVoiceStatus()).toBe('paused');

  speak('Vogel', 'de-DE');
  expect(spoken).toEqual(['Maus', 'Vogel']);
  expect(fetchMock).toHaveBeenCalledTimes(1);

  saveElevenLabsKey('key-4');
  expect(getVoiceStatus()).toBe('on');
});

test('pauses ElevenLabs when the credits run out', async () => {
  saveElevenLabsKey('key-5');
  fetchMock.mockResolvedValue(
    new Response('{"detail":{"status":"quota_exceeded"}}', { status: 400 }),
  );

  speak('Fisch', 'de-DE');
  await vi.waitFor(() => expect(getVoiceStatus()).toBe('paused'));
});

test('reads the hint with ElevenLabs too, a moment after the word', async () => {
  saveElevenLabsKey('key-7');
  fetchMock.mockImplementation(async () => audioResponse());

  speak('morze', 'pl-PL', 'zbiornik słonej wody');
  await vi.waitFor(() => expect(played).toHaveLength(1));
  played[0].onended?.();

  await vi.waitFor(() => expect(played).toHaveLength(2), { timeout: HINT_DELAY_MS + 1000 });
  expect(JSON.parse(fetchMock.mock.calls[1][1]?.body as string)).toMatchObject({
    text: 'zbiornik słonej wody',
  });
  expect(spoken).toEqual([]);
});

test('picks a voice for the language, preferring an offline one', () => {
  voices = [
    { name: 'English', lang: 'en-US', localService: true, default: true },
    { name: 'Google Deutsch', lang: 'de-DE', localService: false },
    { name: 'Anna', lang: 'de_DE', localService: true },
  ];
  expect(findVoice('de-DE')?.name).toBe('Anna');
  expect(findVoice('pl-PL')).toBeNull();

  speak('drei', 'de-DE');
  expect(queue[0].voice?.name).toBe('Anna');
});

test('falls back to a voice for the same language elsewhere', () => {
  voices = [{ name: 'Helena', lang: 'de-AT', localService: true }];
  expect(findVoice('de-DE')?.name).toBe('Helena');
});

test('reads the word again without the voice when the voice fails', () => {
  voices = [{ name: 'Anna', lang: 'de-DE', localService: true }];
  speak('drei', 'de-DE');
  const failed = queue.shift()!;
  failed.onerror?.({ error: 'voice-unavailable' });

  expect(spoken).toEqual(['drei', 'drei']);
  expect(queue[0].voice).toBeUndefined();
});

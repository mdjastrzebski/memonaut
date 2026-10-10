import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { HINT_DELAY_MS, speak, stopHint } from './speech';

interface FakeUtterance {
  text: string;
  onend?: () => void;
}

const queue: FakeUtterance[] = [];
const spoken: string[] = [];

/** Finishes reading the first word in the queue. */
function finishReading() {
  queue.shift()?.onend?.();
}

beforeEach(() => {
  queue.length = 0;
  spoken.length = 0;
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
    speak: (utterance: FakeUtterance) => {
      queue.push(utterance);
      spoken.push(utterance.text);
    },
  });
});

afterEach(() => {
  stopHint();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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

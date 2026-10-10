import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { speak } from './speech';

const queue: string[] = [];

beforeEach(() => {
  queue.length = 0;
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
    speak: (utterance: { text: string }) => queue.push(utterance.text),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('does not queue a word again while it is still being read', () => {
  speak('drei', 'de-DE');
  speak('drei', 'de-DE');
  expect(queue).toEqual(['drei']);
});

test('queues a different word, or the same one once reading has finished', () => {
  speak('drei', 'de-DE');
  speak('vier', 'de-DE');
  expect(queue).toEqual(['drei', 'vier']);

  queue.length = 0;
  speak('vier', 'de-DE');
  expect(queue).toEqual(['vier']);
});

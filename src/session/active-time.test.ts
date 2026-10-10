import { expect, test } from 'vitest';

import {
  getActiveMs,
  IDLE_TIMEOUT_MS,
  pauseActiveTime,
  recordActivity,
  startActiveTime,
} from './active-time';

const seconds = (n: number) => n * 1000;

test('counts time while the learner keeps answering', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, seconds(20));
  time = recordActivity(time, seconds(40));

  expect(getActiveMs(time, seconds(50))).toBe(seconds(50));
});

test('stops the idle timeout after the last input', () => {
  const time = recordActivity(startActiveTime(0), seconds(10));

  expect(getActiveMs(time, seconds(10) + IDLE_TIMEOUT_MS)).toBe(seconds(10) + IDLE_TIMEOUT_MS);
  expect(getActiveMs(time, seconds(600))).toBe(seconds(10) + IDLE_TIMEOUT_MS);
});

test('goes on with the next input after being idle', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, seconds(300));

  expect(getActiveMs(time, seconds(305))).toBe(IDLE_TIMEOUT_MS + seconds(5));
});

test('pauses until the next input', () => {
  let time = pauseActiveTime(startActiveTime(0), seconds(5));

  expect(getActiveMs(time, seconds(100))).toBe(seconds(5));

  time = recordActivity(time, seconds(100));
  expect(getActiveMs(time, seconds(110))).toBe(seconds(15));
});

test('pausing twice keeps the time', () => {
  const time = pauseActiveTime(pauseActiveTime(startActiveTime(0), seconds(5)), seconds(20));

  expect(getActiveMs(time, seconds(20))).toBe(seconds(5));
});

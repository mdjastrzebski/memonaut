import { expect, test } from 'vitest';

import {
  getActiveMs,
  IDLE_CREDIT_MS,
  IDLE_TIMEOUT_MS,
  pauseActiveTime,
  recordActivity,
  startActiveTime,
} from './active-time';

const seconds = (n: number) => n * 1000;

test('counts time while the learner keeps answering', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, seconds(15));
  time = recordActivity(time, seconds(30));

  expect(getActiveMs(time, seconds(35))).toBe(seconds(35));
});

test('counts the whole gap up to the idle timeout once the next input comes', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, IDLE_TIMEOUT_MS);

  expect(getActiveMs(time, IDLE_TIMEOUT_MS)).toBe(IDLE_TIMEOUT_MS);
});

test('counts only the idle credit after the last input until the next one', () => {
  const time = recordActivity(startActiveTime(0), seconds(10));

  expect(getActiveMs(time, seconds(15))).toBe(seconds(15));
  expect(getActiveMs(time, seconds(10) + IDLE_TIMEOUT_MS)).toBe(seconds(10) + IDLE_CREDIT_MS);
  expect(getActiveMs(time, seconds(600))).toBe(seconds(10) + IDLE_CREDIT_MS);
});

test('goes on with the next input after being idle', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, seconds(300));

  expect(getActiveMs(time, seconds(305))).toBe(IDLE_CREDIT_MS + seconds(5));
});

test('counts only the idle credit for an input just past the idle timeout', () => {
  let time = startActiveTime(0);
  time = recordActivity(time, IDLE_TIMEOUT_MS + 1);

  expect(getActiveMs(time, IDLE_TIMEOUT_MS + 1)).toBe(IDLE_CREDIT_MS);
});

test('pauses until the next input', () => {
  let time = pauseActiveTime(startActiveTime(0), seconds(5));

  expect(getActiveMs(time, seconds(100))).toBe(seconds(5));

  time = recordActivity(time, seconds(100));
  expect(getActiveMs(time, seconds(108))).toBe(seconds(13));
});

test('pausing late counts only the idle credit', () => {
  const time = pauseActiveTime(startActiveTime(0), seconds(15));

  expect(getActiveMs(time, seconds(15))).toBe(IDLE_CREDIT_MS);
});

test('pausing twice keeps the time', () => {
  const time = pauseActiveTime(pauseActiveTime(startActiveTime(0), seconds(5)), seconds(20));

  expect(getActiveMs(time, seconds(20))).toBe(seconds(5));
});
